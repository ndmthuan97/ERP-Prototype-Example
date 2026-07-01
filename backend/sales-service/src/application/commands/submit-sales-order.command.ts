// =============================================================================
// SUBMIT SALES ORDER COMMAND — Synchronous reserve + credit-check
// =============================================================================
// Replaces the old async Saga choreography with synchronous HTTP calls:
//   1. Validate & transition: draft → submitted
//   2. HTTP reserve stock (InventoryClient.reserveBatch)
//   3. HTTP credit check (CustomerClient.checkCredit)
//   4. Confirm or cancel based on results
//   5. Return final status immediately to user
//
// Benefits: user gets confirmed/cancelled in ~100-500ms (was 4-8s with Pub/Sub).

import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  EVENT,
  type SalesOrderSubmittedPayload,
  type SalesOrderConfirmedPayload,
  type SalesOrderCancelledPayload,
} from '@erp/shared';

import {
  EmptyOrderError,
  InvalidStatusTransitionError,
} from '../../domain/entities/index.js';
import {
  SALES_ORDER_REPOSITORY,
  type ISalesOrderRepository,
} from '../../domain/repositories/index.js';
import { InventoryClient } from '../../infrastructure/http/inventory-client.js';
import { CustomerClient } from '../../infrastructure/http/customer-client.js';

@Injectable()
export class SubmitSalesOrderCommand {
  private readonly logger = new Logger(SubmitSalesOrderCommand.name);

  constructor(
    @Inject(SALES_ORDER_REPOSITORY)
    private readonly repo: ISalesOrderRepository,
    private readonly inventoryClient: InventoryClient,
    private readonly customerClient: CustomerClient,
  ) {}

  async execute(orderId: string) {
    const order = await this.repo.findByIdWithLines(orderId);
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }

    const previousStatus = order.status;
    try {
      order.submit();
    } catch (error) {
      if (error instanceof EmptyOrderError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InvalidStatusTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Save submitted status first (for audit trail)
    const submittedPayload: SalesOrderSubmittedPayload = {
      orderId: order.id,
      customerId: order.customerId,
      totalAmount: Number(order.totalAmount),
      lines: order.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
      })),
    };

    await this.repo.update(
      order,
      [
        {
          eventType: EVENT.SALES_ORDER_SUBMITTED,
          payload: submittedPayload as unknown as Record<string, unknown>,
        },
      ],
      {
        fromStatus: previousStatus,
        toStatus: 'submitted',
        changedBy: 'system',
      },
      {
        customerName: '',
        status: 'submitted',
        totalAmount: Number(order.totalAmount),
        lineCount: order.lines.length,
        createdAt: order.createdAt,
        lastStatusChange: new Date(),
      },
    );

    // Step 2: Reserve stock via HTTP
    const lines = order.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
    }));

    const reserveResult = await this.inventoryClient.reserveBatch(
      order.id,
      lines,
    );

    if (!reserveResult.reserved) {
      // Insufficient stock or inventory service down → cancel
      const reason = 'Insufficient stock (inventory reservation failed)';
      order.markFailedNoStock();

      await this.repo.update(
        order,
        [],
        {
          fromStatus: 'submitted',
          toStatus: 'cancelled',
          changedBy: 'system',
          reason,
        },
        {
          customerName: '',
          status: 'cancelled',
          totalAmount: Number(order.totalAmount),
          lineCount: order.lines.length,
          createdAt: order.createdAt,
          lastStatusChange: new Date(),
        },
      );

      this.logger.log(`Order "${orderId}" cancelled — insufficient stock`);
      return {
        id: order.id,
        status: order.status,
        reason,
      };
    }

    // Step 3: Credit check via HTTP (existing pattern)
    const pendingOrdersTotal = await this.repo.sumPendingOrdersTotal(
      order.customerId,
      order.id,
    );

    let creditSufficient = false;
    let creditReason = '';
    try {
      const credit = await this.customerClient.checkCredit(
        order.customerId,
        Number(order.totalAmount),
        pendingOrdersTotal,
      );
      creditSufficient = credit.sufficient;
      if (!creditSufficient) {
        creditReason = `Insufficient credit: required ${Number(order.totalAmount)}, available ${credit.available}`;
      }
    } catch (error) {
      creditReason = `Credit check error: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (!creditSufficient) {
      // Release stock (compensation) + cancel
      await this.inventoryClient.releaseBatch(order.id, lines);

      order.markFailedCredit(creditReason);
      const cancelPayload: SalesOrderCancelledPayload = {
        orderId: order.id,
        reason: creditReason,
        lines,
      };
      await this.repo.update(
        order,
        [
          {
            eventType: EVENT.SALES_ORDER_CANCELLED,
            payload: cancelPayload as unknown as Record<string, unknown>,
          },
        ],
        {
          fromStatus: 'submitted',
          toStatus: 'cancelled',
          changedBy: 'system',
          reason: creditReason,
        },
        {
          customerName: '',
          status: 'cancelled',
          totalAmount: Number(order.totalAmount),
          lineCount: order.lines.length,
          createdAt: order.createdAt,
          lastStatusChange: new Date(),
        },
      );

      this.logger.log(`Order "${orderId}" cancelled — ${creditReason}`);
      return {
        id: order.id,
        status: order.status,
        reason: creditReason,
      };
    }

    // Step 4: Confirm order
    order.confirm();
    const confirmPayload: SalesOrderConfirmedPayload = {
      orderId: order.id,
    };
    await this.repo.update(
      order,
      [
        {
          eventType: EVENT.SALES_ORDER_CONFIRMED,
          payload: confirmPayload as unknown as Record<string, unknown>,
        },
      ],
      {
        fromStatus: 'submitted',
        toStatus: 'confirmed',
        changedBy: 'system',
      },
      {
        customerName: '',
        status: 'confirmed',
        totalAmount: Number(order.totalAmount),
        lineCount: order.lines.length,
        createdAt: order.createdAt,
        lastStatusChange: new Date(),
      },
    );

    this.logger.log(
      `Order "${orderId}" confirmed — saga completed synchronously`,
    );
    return {
      id: order.id,
      status: order.status,
      message: 'Order confirmed.',
    };
  }
}
