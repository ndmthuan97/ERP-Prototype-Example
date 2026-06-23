// =============================================================================
// ORDER EVENT SUBSCRIBER — Pub/Sub consumer cho saga events
// =============================================================================
// Lắng nghe:
// - inventory.reserved → HandleInventoryReservedCommand (credit check → confirm/cancel)
// - inventory.reservation-failed → HandleReservationFailedCommand (cancel, no compensation)

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EVENT, PubSubSubscriber } from '@erp/shared';

import { HandleInventoryReservedCommand } from '../../application/commands/handle-inventory-reserved.command.js';
import { HandleReservationFailedCommand } from '../../application/commands/handle-reservation-failed.command.js';

@Injectable()
export class SalesEventSubscriber implements OnModuleInit {
  private readonly logger = new Logger(SalesEventSubscriber.name);

  constructor(
    private readonly subscriber: PubSubSubscriber,
    private readonly handleReserved: HandleInventoryReservedCommand,
    private readonly handleFailed: HandleReservationFailedCommand,
  ) {}

  onModuleInit(): void {
    this.logger.log('Registering order saga event handlers...');

    this.subscriber.register({
      topic: EVENT.INVENTORY_RESERVED,
      subscription: 'sales-service.inventory.reserved',
      handler: async (envelope) => {
        await this.handleReserved.execute(envelope);
      },
    });

    this.subscriber.register({
      topic: EVENT.INVENTORY_RESERVATION_FAILED,
      subscription: 'sales-service.inventory.reservation-failed',
      handler: async (envelope) => {
        await this.handleFailed.execute(envelope);
      },
    });
  }
}
