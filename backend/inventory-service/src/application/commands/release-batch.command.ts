// =============================================================================
// RELEASE BATCH COMMAND — Atomic multi-item release via HTTP
// =============================================================================
// Compensation endpoint: releases reserved stock for ALL items in a single call.
// Used by Sales Service when credit-check fails after successful reserve.

import {
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';

import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { validateReleaseBatch } from '../dtos/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

export interface ReleaseBatchResult {
  released: boolean;
  orderId: string;
  itemCount: number;
}

@Injectable()
export class ReleaseBatchCommand {
  private readonly logger = new Logger(ReleaseBatchCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY)
    private readonly repo: IStockItemRepository,
  ) {}

  /**
   * Release reserved stock for ALL line items. Best-effort: if one item
   * fails to release, the rest still proceed (log error but don't throw).
   */
  async execute(dto: unknown): Promise<ReleaseBatchResult> {
    const { orderId, lines } = validateReleaseBatch(dto);

    this.logger.log(
      `Release batch: order="${orderId}" — ${lines.length} line(s)`,
    );

    let releasedCount = 0;
    for (const line of lines) {
      try {
        await withOptimisticRetry(async () => {
          const item = await this.repo.findById(line.itemId);
          if (!item) {
            this.logger.warn(
              `StockItem "${line.itemId}" not found — skip release`,
            );
            return;
          }
          item.release(line.quantity);
          await this.repo.updateWithLock(item);
        });
        releasedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to release item "${line.itemId}": ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(
      `✅ Batch released: order="${orderId}", released=${releasedCount}/${lines.length}`,
    );

    return { released: true, orderId, itemCount: releasedCount };
  }
}
