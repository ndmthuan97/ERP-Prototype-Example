// =============================================================================
// RETURN CONTROLLER — REST endpoints for sales return management
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
  CreateSalesReturnCommand,
  CreateReturnBodyDto,
} from '../application/commands/create-sales-return.command.js';
import { UpdateSalesReturnStatusCommand } from '../application/commands/update-sales-return-status.command.js';
import { GetSalesReturnsQuery } from '../application/queries/get-sales-returns.query.js';

@Controller('orders/:orderId/returns')
export class ReturnController {
  constructor(
    private readonly createReturnCommand: CreateSalesReturnCommand,
    private readonly updateStatusCommand: UpdateSalesReturnStatusCommand,
    private readonly getReturnsQuery: GetSalesReturnsQuery,
  ) {}

  /** POST /orders/:orderId/returns — Create a return for a fulfilled order */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: CreateReturnBodyDto })
  async create(
    @Param('orderId') orderId: string,
    @Body() body: CreateReturnBodyDto,
  ) {
    return this.createReturnCommand.execute(orderId, body);
  }

  /** GET /orders/:orderId/returns — List all returns for a SO */
  @Get()
  async list(@Param('orderId') orderId: string) {
    return this.getReturnsQuery.execute(orderId);
  }

  /** POST /orders/:orderId/returns/:id/approve — Approve a return */
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    return this.updateStatusCommand.execute(id, 'approve');
  }

  /** POST /orders/:orderId/returns/:id/reject — Reject a return */
  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    return this.updateStatusCommand.execute(id, 'reject');
  }

  /** POST /orders/:orderId/returns/:id/receive-goods — Mark goods received */
  @Post(':id/receive-goods')
  async receiveGoods(@Param('id') id: string) {
    return this.updateStatusCommand.execute(id, 'receive_goods');
  }

  /** POST /orders/:orderId/returns/:id/complete — Complete the return */
  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.updateStatusCommand.execute(id, 'complete');
  }
}
