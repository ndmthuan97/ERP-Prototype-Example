// =============================================================================
// CUSTOMER CLIENT — HTTP call to customer-service for credit-check
// =============================================================================
// Saga step 3a: after inventory reserved → HTTP credit-check.
// Only synchronous coupling between 2 services — intentional to demonstrate
// both communication styles (event + HTTP) within one saga.
//
// Circuit Breaker (opossum) wraps the HTTP call:
// - Opens after 50% failures → fast-fail without waiting for timeout
// - Half-open after 30s → probe 1 request to test recovery
// - Fallback: insufficient=true to safely cancel order (no silent approval)

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CreditCheckResult {
  creditLimit: number;
  creditUsed: number;
  available: number;
  sufficient: boolean;
}

const CUSTOMER_SERVICE_URL =
  process.env.CUSTOMER_SERVICE_URL ?? 'http://localhost:3001';
const TIMEOUT_MS = 5000;

@Injectable()
export class CustomerClient implements OnModuleInit {
  private readonly logger = new Logger(CustomerClient.name);
  private breaker!: CircuitBreaker<[string, number], CreditCheckResult>;

  onModuleInit(): void {
    this.breaker = new CircuitBreaker(
      (customerId: string, orderAmount: number) =>
        this.doCheckCredit(customerId, orderAmount),
      {
        timeout: TIMEOUT_MS,
        errorThresholdPercentage: 50,
        resetTimeout: 30_000,
        volumeThreshold: 3,
      },
    );

    this.breaker.fallback((_customerId: string, _orderAmount: number) => ({
      creditLimit: 0,
      creditUsed: 0,
      available: 0,
      sufficient: false,
    }));

    this.breaker.on('open', () =>
      this.logger.warn('Circuit OPEN — credit-check calls will be short-circuited'),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.log('Circuit HALF-OPEN — probing credit-check service'),
    );
    this.breaker.on('close', () =>
      this.logger.log('Circuit CLOSED — credit-check service recovered'),
    );
  }

  /**
   * Public entry point — goes through circuit breaker.
   */
  async checkCredit(
    customerId: string,
    orderAmount: number,
  ): Promise<CreditCheckResult> {
    return this.breaker.fire(customerId, orderAmount);
  }

  /**
   * Actual HTTP call — only invoked when circuit is closed/half-open.
   */
  private async doCheckCredit(
    customerId: string,
    orderAmount: number,
  ): Promise<CreditCheckResult> {
    const url = `${CUSTOMER_SERVICE_URL}/v1/customers/${customerId}/credit-check`;
    this.logger.log(
      `Credit check: customer="${customerId}", amount=${orderAmount}`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Credit check failed: HTTP ${response.status} — ${body}`,
        );
      }

      const data = (await response.json()) as {
        creditLimit: number;
        creditUsed: number;
        available: number;
      };

      const sufficient = data.available >= orderAmount;
      this.logger.log(
        `Credit check result: available=${data.available}, needed=${orderAmount}, sufficient=${sufficient}`,
      );

      return { ...data, sufficient };
    } finally {
      clearTimeout(timeout);
    }
  }
}
