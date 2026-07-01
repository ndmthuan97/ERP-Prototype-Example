// =============================================================================
// HANDLE SALES ORDER CANCELLED — Saga compensation
// =============================================================================
// Nhận event sales-order.cancelled → nhả tồn kho đã giữ cho TẤT CẢ line items.
// Đây là bước compensation: đơn đã bị hủy (vd credit check fail) → trả hàng về kho.

import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  EVENT,
  type EventEnvelope,
  type SalesOrderCancelledPayload,
} from '@erp/shared';

import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';
import { withOptimisticRetry } from '../optimistic-retry.js';

@Injectable()
export class HandleSalesOrderCancelledCommand {
  private readonly logger = new Logger(HandleSalesOrderCancelledCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY) private readonly repo: IStockItemRepository,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as SalesOrderCancelledPayload;
    const { orderId, lines } = payload;

    this.logger.log(
      `Saga compensation: release tồn kho cho order "${orderId}" — ${lines.length} line(s)`,
    );

    for (const line of lines) {
      try {
        await withOptimisticRetry(async () => {
          const item = await this.repo.findById(line.itemId);
          if (!item) {
            this.logger.warn(
              `StockItem "${line.itemId}" không tồn tại — skip release`,
            );
            return;
          }
          item.release(line.quantity);
          await this.repo.updateWithLock(item);
        });
      } catch (error) {
        this.logger.error(
          `Release thất bại cho item "${line.itemId}": ${String(error)}`,
        );
      }
    }

    // Tất cả line items đã release xong → publish event
    await this.repo.createOutboxEvent({
      eventType: EVENT.INVENTORY_RELEASED,
      payload: { orderId, reservationId: uuidv4() },
    });

    this.logger.log(`✅ Inventory released cho order "${orderId}"`);
  }
}
