/**
 * Order Controller — Presentation Layer
 *
 * Delegate cho Application (Command/Query). KHÔNG chứa business logic.
 * Validation trong Command (Zod); ZodError → ZodExceptionFilter → 400.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { CreateSalesOrderCommand } from '../application/commands/create-sales-order.command.js';
import { AddLineCommand } from '../application/commands/add-line.command.js';
import { SubmitSalesOrderCommand } from '../application/commands/submit-sales-order.command.js';
import { CancelSalesOrderCommand } from '../application/commands/cancel-sales-order.command.js';
import { FulfilSalesOrderCommand } from '../application/commands/fulfil-sales-order.command.js';
import { GetSalesOrderQuery } from '../application/queries/get-sales-order.query.js';
import { SearchSalesOrdersQuery } from '../application/queries/search-sales-orders.query.js';
import { GetLifecycleQuery } from '../application/queries/get-lifecycle.query.js';

@Controller('orders')
export class SalesOrderController {
  constructor(
    private readonly createOrderCommand: CreateSalesOrderCommand,
    private readonly addLineCommand: AddLineCommand,
    private readonly submitOrderCommand: SubmitSalesOrderCommand,
    private readonly cancelOrderCommand: CancelSalesOrderCommand,
    private readonly fulfilOrderCommand: FulfilSalesOrderCommand,
    private readonly getOrderQuery: GetSalesOrderQuery,
    private readonly searchOrdersQuery: SearchSalesOrdersQuery,
    private readonly getLifecycleQuery: GetLifecycleQuery,
  ) {}

  /** POST /orders — tạo order (draft) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    return this.createOrderCommand.execute(body);
  }

  /** POST /orders/:id/lines — thêm dòng hàng */
  @Post(':id/lines')
  @HttpCode(HttpStatus.CREATED)
  async addLine(@Param('id') id: string, @Body() body: unknown) {
    return this.addLineCommand.execute(id, body);
  }

  /** POST /orders/:id/submit — submit (trigger saga) */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id') id: string) {
    return this.submitOrderCommand.execute(id);
  }

  /** POST /orders/:id/cancel — hủy order */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Body() body: unknown) {
    return this.cancelOrderCommand.execute(id, body);
  }

  /** POST /orders/:id/fulfil — fulfil confirmed order */
  @Post(':id/fulfil')
  @HttpCode(HttpStatus.OK)
  async fulfil(@Param('id') id: string) {
    return this.fulfilOrderCommand.execute(id);
  }

  /** GET /orders — danh sách (phân trang + filter status) */
  @Get()
  async search(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.searchOrdersQuery.execute({ page, limit, status });
  }

  /** GET /orders/:id — chi tiết (header + lines) */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.getOrderQuery.execute(id);
  }

  /** GET /orders/:id/lifecycle — CQRS read model (timeline) */
  @Get(':id/lifecycle')
  async lifecycle(@Param('id') id: string) {
    return this.getLifecycleQuery.execute(id);
  }
}
