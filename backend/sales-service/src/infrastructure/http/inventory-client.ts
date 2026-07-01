// =============================================================================
// INVENTORY CLIENT — HTTP call to inventory-service for reserve/release
// =============================================================================
// Synchronous stock reservation replacing the async Pub/Sub saga.
// Circuit Breaker (opossum) wraps all HTTP calls:
// - Opens after 50% failures → fast-fail without waiting for timeout
// - Half-open after 30s → probe 1 request to test recovery
// - Fallback: reserve fails safely (order will be cancelled)

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface ReserveBatchResult {
  reserved: boolean;
  reservationId: string;
  orderId: string;
}

export interface ReleaseBatchResult {
  released: boolean;
  orderId: string;
  itemCount: number;
}

export interface BatchLineInput {
  itemId: string;
  quantity: number;
}

const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:3003';
const TIMEOUT_MS = 5000;

@Injectable()
export class InventoryClient implements OnModuleInit {
  private readonly logger = new Logger(InventoryClient.name);
  private reserveBreaker!: CircuitBreaker<
    [string, BatchLineInput[]],
    ReserveBatchResult
  >;
  private releaseBreaker!: CircuitBreaker<
    [string, BatchLineInput[]],
    ReleaseBatchResult
  >;

  onModuleInit(): void {
    this.reserveBreaker = new CircuitBreaker(
      (orderId: string, lines: BatchLineInput[]) =>
        this.doReserveBatch(orderId, lines),
      {
        timeout: TIMEOUT_MS,
        errorThresholdPercentage: 50,
        resetTimeout: 30_000,
        volumeThreshold: 3,
      },
    );

    this.reserveBreaker.fallback(
      (_orderId: string, _lines: BatchLineInput[]) => ({
        reserved: false,
        reservationId: '',
        orderId: _orderId,
      }),
    );

    this.reserveBreaker.on('open', () =>
      this.logger.warn(
        'Circuit OPEN — reserve-batch calls will be short-circuited',
      ),
    );
    this.reserveBreaker.on('halfOpen', () =>
      this.logger.log('Circuit HALF-OPEN — probing inventory service'),
    );
    this.reserveBreaker.on('close', () =>
      this.logger.log('Circuit CLOSED — inventory service recovered'),
    );

    this.releaseBreaker = new CircuitBreaker(
      (orderId: string, lines: BatchLineInput[]) =>
        this.doReleaseBatch(orderId, lines),
      {
        timeout: TIMEOUT_MS,
        errorThresholdPercentage: 50,
        resetTimeout: 30_000,
        volumeThreshold: 3,
      },
    );

    // Release fallback: log error but don't fail the flow
    this.releaseBreaker.fallback(
      (_orderId: string, _lines: BatchLineInput[]) => ({
        released: false,
        orderId: _orderId,
        itemCount: 0,
      }),
    );
  }

  /**
   * Reserve ALL items for an order. Returns result directly (synchronous).
   * If circuit is open or inventory is down → fallback: reserved=false.
   */
  async reserveBatch(
    orderId: string,
    lines: BatchLineInput[],
  ): Promise<ReserveBatchResult> {
    return this.reserveBreaker.fire(orderId, lines);
  }

  /**
   * Release ALL reserved items for an order (compensation).
   * Best-effort: failures are logged but don't propagate.
   */
  async releaseBatch(
    orderId: string,
    lines: BatchLineInput[],
  ): Promise<ReleaseBatchResult> {
    return this.releaseBreaker.fire(orderId, lines);
  }

  private async doReserveBatch(
    orderId: string,
    lines: BatchLineInput[],
  ): Promise<ReserveBatchResult> {
    const url = `${INVENTORY_SERVICE_URL}/v1/inventory/items/batch/reserve`;
    this.logger.log(
      `Reserve batch: order="${orderId}", ${lines.length} line(s)`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, lines }),
        signal: controller.signal,
      });

      if (response.status === 409) {
        // Insufficient stock — expected business error, not a circuit-breaker failure
        return {
          reserved: false,
          reservationId: '',
          orderId,
        };
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Reserve batch failed: HTTP ${response.status} — ${body}`,
        );
      }

      return (await response.json()) as ReserveBatchResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async doReleaseBatch(
    orderId: string,
    lines: BatchLineInput[],
  ): Promise<ReleaseBatchResult> {
    const url = `${INVENTORY_SERVICE_URL}/v1/inventory/items/batch/release`;
    this.logger.log(
      `Release batch: order="${orderId}", ${lines.length} line(s)`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, lines }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Release batch failed: HTTP ${response.status} — ${body}`,
        );
      }

      return (await response.json()) as ReleaseBatchResult;
    } finally {
      clearTimeout(timeout);
    }
  }
}
