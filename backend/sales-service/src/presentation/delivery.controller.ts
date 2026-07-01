// =============================================================================
// DELIVERY CONTROLLER — REST endpoints for delivery order management
// =============================================================================
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

import {
  CreateDeliveryOrderCommand,
  CreateDeliveryBodyDto,
} from '../application/commands/create-delivery-order.command.js';
import { UpdateDeliveryStatusCommand } from '../application/commands/update-delivery-status.command.js';
import { HandleDeliveryCompletedCommand } from '../application/commands/handle-delivery-completed.command.js';
import { GetDeliveryOrdersQuery } from '../application/queries/get-delivery-orders.query.js';

@Controller('orders/:orderId/deliveries')
export class DeliveryController {
  constructor(
    private readonly createDeliveryCommand: CreateDeliveryOrderCommand,
    private readonly updateStatusCommand: UpdateDeliveryStatusCommand,
    private readonly handleDeliveryCompleted: HandleDeliveryCompletedCommand,
    private readonly getDeliveriesQuery: GetDeliveryOrdersQuery,
  ) {}

  /** POST /orders/:orderId/deliveries — Create a delivery order */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: CreateDeliveryBodyDto })
  async create(
    @Param('orderId') orderId: string,
    @Body() body: CreateDeliveryBodyDto,
  ) {
    return this.createDeliveryCommand.execute(orderId, body);
  }

  /** GET /orders/:orderId/deliveries — List all deliveries for a SO */
  @Get()
  async list(@Param('orderId') orderId: string) {
    return this.getDeliveriesQuery.execute(orderId);
  }

  /** POST .../deliveries/:id/start-picking — draft → picking */
  @Post(':id/start-picking')
  async startPicking(@Param('id') id: string) {
    return this.updateStatusCommand.execute(id, 'start_picking');
  }

  /** POST .../deliveries/:id/pack — picking → packed */
  @Post(':id/pack')
  async pack(@Param('id') id: string) {
    return this.updateStatusCommand.execute(id, 'pack');
  }

  /** POST .../deliveries/:id/ship — packed → shipped */
  @Post(':id/ship')
  async ship(@Param('id') id: string) {
    return this.updateStatusCommand.execute(id, 'ship');
  }

  /** POST .../deliveries/:id/deliver — shipped → delivered, then updates SO */
  @Post(':id/deliver')
  async deliver(@Param('orderId') orderId: string, @Param('id') id: string) {
    const result = await this.updateStatusCommand.execute(id, 'deliver');
    // After delivery completes, update the SO status (partial/full) and issue
    // the just-delivered quantities out of reserved inventory. Passing the DO id
    // lets the handler emit only this delivery's lines (the delta).
    await this.handleDeliveryCompleted.execute(orderId, id);
    return result;
  }

  /** POST .../deliveries/:id/fail — shipped → failed */
  @Post(':id/fail')
  async fail(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.updateStatusCommand.execute(id, 'fail', body.reason);
  }
}
