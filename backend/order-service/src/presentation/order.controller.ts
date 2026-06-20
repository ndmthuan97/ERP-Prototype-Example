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

import { CreateOrderCommand } from '../application/commands/create-order.command.js';
import { AddLineCommand } from '../application/commands/add-line.command.js';
import { SubmitOrderCommand } from '../application/commands/submit-order.command.js';
import { CancelOrderCommand } from '../application/commands/cancel-order.command.js';
import { GetOrderQuery } from '../application/queries/get-order.query.js';
import { SearchOrdersQuery } from '../application/queries/search-orders.query.js';
import { GetLifecycleQuery } from '../application/queries/get-lifecycle.query.js';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly createOrderCommand: CreateOrderCommand,
    private readonly addLineCommand: AddLineCommand,
    private readonly submitOrderCommand: SubmitOrderCommand,
    private readonly cancelOrderCommand: CancelOrderCommand,
    private readonly getOrderQuery: GetOrderQuery,
    private readonly searchOrdersQuery: SearchOrdersQuery,
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
