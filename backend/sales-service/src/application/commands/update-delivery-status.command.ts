// =============================================================================
// UPDATE DELIVERY STATUS COMMAND — Transition DO through its lifecycle
// =============================================================================
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';

import {
  DELIVERY_ORDER_REPOSITORY,
  type IDeliveryOrderRepository,
} from '../../domain/repositories/index.js';

type DeliveryAction = 'start_picking' | 'pack' | 'ship' | 'deliver' | 'fail';

@Injectable()
export class UpdateDeliveryStatusCommand {
  constructor(
    @Inject(DELIVERY_ORDER_REPOSITORY) private readonly repo: IDeliveryOrderRepository,
  ) {}

  async execute(deliveryId: string, action: DeliveryAction, reason?: string) {
    const delivery = await this.repo.findById(deliveryId);
    if (!delivery) {
      throw new NotFoundException(`Delivery order "${deliveryId}" not found`);
    }

    switch (action) {
      case 'start_picking':
        delivery.startPicking();
        break;
      case 'pack':
        delivery.pack();
        break;
      case 'ship':
        delivery.ship();
        break;
      case 'deliver':
        delivery.confirmDelivery();
        break;
      case 'fail':
        delivery.markFailed(reason ?? 'Unknown failure');
        break;
      default:
        throw new BadRequestException(`Invalid action "${action}"`);
    }

    return this.repo.update(delivery);
  }
}
