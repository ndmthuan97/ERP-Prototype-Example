// =============================================================================
// INVENTORY EVENT SUBSCRIBER — Pub/Sub consumer for domain events
// =============================================================================
// Listens to:
// - sales-order.cancelled → HandleSalesOrderCancelledCommand (release stock — compensation)
// - product.created → HandleProductCreatedCommand (auto-create stock item)
// - goods.received → HandleGoodsReceivedCommand (receive stock from PO)
// - sales-order.fulfilled → HandleSalesOrderFulfilledCommand (issue stock for shipment)
//
// NOTE: sales-order.submitted is NO LONGER consumed here. Stock reservation is
// now handled synchronously via HTTP POST /v1/inventory/items/batch/reserve.

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EVENT, PubSubSubscriber } from '@erp/shared';

import { HandleSalesOrderCancelledCommand } from '../../application/commands/handle-sales-order-cancelled.command.js';
import { HandleProductCreatedCommand } from '../../application/commands/handle-product-created.command.js';
import { HandleGoodsReceivedCommand } from '../../application/commands/handle-goods-received.command.js';
import { HandleSalesOrderFulfilledCommand } from '../../application/commands/handle-sales-order-fulfilled.command.js';
import { HandleSalesReturnReceivedCommand } from '../../application/commands/handle-sales-return-received.command.js';

@Injectable()
export class InventoryEventSubscriber implements OnModuleInit {
  private readonly logger = new Logger(InventoryEventSubscriber.name);

  constructor(
    private readonly subscriber: PubSubSubscriber,
    private readonly handleCancelled: HandleSalesOrderCancelledCommand,
    private readonly handleProductCreated: HandleProductCreatedCommand,
    private readonly handleGoodsReceived: HandleGoodsReceivedCommand,
    private readonly handleSalesOrderFulfilled: HandleSalesOrderFulfilledCommand,
    private readonly handleSalesReturnReceived: HandleSalesReturnReceivedCommand,
  ) {}

  onModuleInit(): void {
    this.logger.log('Registering inventory event handlers...');

    // Compensation: release stock on order cancellation (from confirmed state)
    this.subscriber.register({
      topic: EVENT.SALES_ORDER_CANCELLED,
      subscription: 'inventory-service.sales-order.cancelled',
      handler: async (envelope) => {
        await this.handleCancelled.execute(envelope);
      },
    });

    // Cross-context: auto-create stock item when product is created
    this.subscriber.register({
      topic: EVENT.PRODUCT_CREATED,
      subscription: 'inventory-service.product.created',
      handler: async (envelope) => {
        await this.handleProductCreated.execute(envelope);
      },
    });

    // Cross-context: receive stock when goods arrive from PO
    this.subscriber.register({
      topic: EVENT.GOODS_RECEIVED,
      subscription: 'inventory-service.goods.received',
      handler: async (envelope) => {
        await this.handleGoodsReceived.execute(envelope);
      },
    });

    // Cross-context: issue stock when sales order is fulfilled
    this.subscriber.register({
      topic: EVENT.SALES_ORDER_FULFILLED,
      subscription: 'inventory-service.sales-order.fulfilled',
      handler: async (envelope) => {
        await this.handleSalesOrderFulfilled.execute(envelope);
      },
    });

    // Cross-context: restock available stock when returned goods are received
    this.subscriber.register({
      topic: EVENT.SALES_RETURN_GOODS_RECEIVED,
      subscription: 'inventory-service.sales-return.goods-received',
      handler: async (envelope) => {
        await this.handleSalesReturnReceived.execute(envelope);
      },
    });
  }
}
