// =============================================================================
// RESERVE BATCH COMMAND — Atomic multi-item reservation via HTTP
// =============================================================================
// Replaces the Pub/Sub-based HandleSalesOrderSubmittedCommand with a synchronous
// HTTP endpoint. ALL items are reserved in ONE transaction — either all succeed
// or none (fixing the non-atomic reserve issue).

import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { InsufficientStockError } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { validateReserveBatch } from '../dtos/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

export interface ReserveBatchResult {
  reserved: boolean;
  reservationId: string;
  orderId: string;
}

@Injectable()
export class ReserveBatchCommand {
  private readonly logger = new Logger(ReserveBatchCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Reserve ALL line items atomically. Each item is reserved with optimistic
   * locking + retry. If ANY item fails, all previously reserved items are
   * rolled back before throwing.
   *
   * @returns { reserved: true, reservationId, orderId }
   * @throws ConflictException if insufficient stock for any item
   */
  async execute(dto: unknown): Promise<ReserveBatchResult> {
    const { orderId, lines } = validateReserveBatch(dto);
    const reservationId = uuidv4();

    this.logger.log(
      `Reserve batch: order="${orderId}" — ${lines.length} line(s)`,
    );

    const reserved: { itemId: string; quantity: number }[] = [];

    try {
      for (const line of lines) {
        await withOptimisticRetry(async () => {
          const item = await this.repo.findById(line.itemId);
          if (!item) {
            throw new Error(`StockItem "${line.itemId}" not found`);
          }
          item.reserve(line.quantity);
          await this.repo.updateWithLock(item);
        });
        reserved.push({ itemId: line.itemId, quantity: line.quantity });
      }

      this.logger.log(
        `✅ Batch reserved: order="${orderId}", reservationId="${reservationId}"`,
      );
      return { reserved: true, reservationId, orderId };
    } catch (error) {
      // Rollback: release all successfully reserved items
      this.logger.warn(
        `Reserve batch failed for order "${orderId}" — rolling back ${reserved.length} item(s)`,
      );

      for (const res of reserved) {
        try {
          await withOptimisticRetry(async () => {
            const item = await this.repo.findById(res.itemId);
            if (item) {
              item.release(res.quantity);
              await this.repo.updateWithLock(item);
            }
          });
        } catch (rollbackError) {
          this.logger.error(
            `Rollback failed for item "${res.itemId}": ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
          );
        }
      }

      if (error instanceof InsufficientStockError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
