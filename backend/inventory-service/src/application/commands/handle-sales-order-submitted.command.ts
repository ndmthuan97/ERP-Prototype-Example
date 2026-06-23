// =============================================================================
// HANDLE SALES ORDER SUBMITTED — Saga step 2
// =============================================================================
// Nhận event sales-order.submitted → reserve tồn kho cho TẤT CẢ line items.
// Nếu thành công → publish inventory.reserved.
// Nếu bất kỳ item nào thiếu hàng → rollback các item đã reserve, publish reservation-failed.

import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  EVENT,
  type EventEnvelope,
  type SalesOrderSubmittedPayload,
} from '@erp/shared';

import { InsufficientStockError } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

@Injectable()
export class HandleSalesOrderSubmittedCommand {
  private readonly logger = new Logger(HandleSalesOrderSubmittedCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY) private readonly repo: IStockItemRepository,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as SalesOrderSubmittedPayload;
    const { orderId, lines } = payload;

    this.logger.log(
      `Saga step 2: reserve tồn kho cho order "${orderId}" — ${lines.length} line(s)`,
    );

    // Theo dõi các item đã reserve thành công để rollback khi cần
    const reserved: { itemId: string; quantity: number }[] = [];

    try {
      for (const line of lines) {
        await withOptimisticRetry(async () => {
          const item = await this.repo.findById(line.itemId);
          if (!item) {
            throw new Error(`StockItem "${line.itemId}" không tồn tại`);
          }
          // Gọi domain method — ném InsufficientStockError nếu không đủ
          item.reserve(line.quantity);
          await this.repo.updateWithLock(item);
        });

        reserved.push({ itemId: line.itemId, quantity: line.quantity });
      }

      // Tất cả line items đã reserve thành công → publish event
      await this.repo.createOutboxEvent({
        eventType: EVENT.INVENTORY_RESERVED,
        payload: { orderId, reservationId: uuidv4() },
      });

      this.logger.log(`✅ Inventory reserved cho order "${orderId}"`);
    } catch (error) {
      // Rollback: nhả các item đã reserve trước đó
      const reason =
        error instanceof InsufficientStockError
          ? error.message
          : `Lỗi reserve: ${error instanceof Error ? error.message : String(error)}`;

      this.logger.warn(
        `❌ Reserve thất bại cho order "${orderId}": ${reason} — rollback ${reserved.length} item(s)`,
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
            `Rollback release thất bại cho item "${res.itemId}": ${rollbackError}`,
          );
        }
      }

      await this.repo.createOutboxEvent({
        eventType: EVENT.INVENTORY_RESERVATION_FAILED,
        payload: { orderId, reason },
      });
    }
  }
}
