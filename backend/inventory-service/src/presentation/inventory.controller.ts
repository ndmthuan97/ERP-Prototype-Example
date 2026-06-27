/**
 * Inventory Controller — Presentation Layer
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

import { CreateItemCommand } from '../application/commands/create-item.command';
import { ReceiveStockCommand } from '../application/commands/receive-stock.command';
import { ReserveStockCommand } from '../application/commands/reserve-stock.command';
import { ReleaseStockCommand } from '../application/commands/release-stock.command';
import { IssueStockCommand } from '../application/commands/issue-stock.command';
import { ReserveBatchCommand } from '../application/commands/reserve-batch.command';
import { ReleaseBatchCommand } from '../application/commands/release-batch.command';
import { GetItemQuery } from '../application/queries/get-item.query';
import { SearchItemsQuery } from '../application/queries/search-items.query';
import { CheckAvailabilityQuery } from '../application/queries/check-availability.query';

@Controller('inventory/items')
export class InventoryController {
  constructor(
    private readonly createItemCommand: CreateItemCommand,
    private readonly receiveStockCommand: ReceiveStockCommand,
    private readonly reserveStockCommand: ReserveStockCommand,
    private readonly releaseStockCommand: ReleaseStockCommand,
    private readonly issueStockCommand: IssueStockCommand,
    private readonly reserveBatchCommand: ReserveBatchCommand,
    private readonly releaseBatchCommand: ReleaseBatchCommand,
    private readonly getItemQuery: GetItemQuery,
    private readonly searchItemsQuery: SearchItemsQuery,
    private readonly checkAvailabilityQuery: CheckAvailabilityQuery,
  ) {}

  /** POST /inventory/items — tạo mặt hàng */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    return this.createItemCommand.execute(body);
  }

  /** GET /inventory/items — tìm kiếm + phân trang */
  @Get()
  async search(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = Number.parseInt(page ?? '', 10);
    const limitNumber = Number.parseInt(limit ?? '', 10);
    return this.searchItemsQuery.execute(
      query ?? '',
      Number.isNaN(pageNumber) ? undefined : pageNumber,
      Number.isNaN(limitNumber) ? undefined : limitNumber,
    );
  }

  /** GET /inventory/items/:sku — chi tiết */
  @Get(':sku')
  async findOne(@Param('sku') sku: string) {
    return this.getItemQuery.execute(sku);
  }

  /** GET /inventory/items/:sku/availability — kiểm tra tồn (Order Service gọi) */
  @Get(':sku/availability')
  async availability(
    @Param('sku') sku: string,
    @Query('quantity') quantity?: string,
  ) {
    const qty = Number.parseInt(quantity ?? '1', 10);
    return this.checkAvailabilityQuery.execute(
      sku,
      Number.isNaN(qty) ? 1 : qty,
    );
  }

  /** POST /inventory/items/:sku/receive — nhập kho */
  @Post(':sku/receive')
  async receive(@Param('sku') sku: string, @Body() body: unknown) {
    return this.receiveStockCommand.execute(sku, body);
  }

  /** POST /inventory/items/:sku/reserve — giữ chỗ (saga) */
  @Post(':sku/reserve')
  async reserve(@Param('sku') sku: string, @Body() body: unknown) {
    return this.reserveStockCommand.execute(sku, body);
  }

  /** POST /inventory/items/:sku/release — nhả giữ chỗ (saga compensation) */
  @Post(':sku/release')
  async release(@Param('sku') sku: string, @Body() body: unknown) {
    return this.releaseStockCommand.execute(sku, body);
  }

  /** POST /inventory/items/:sku/issue — issue stock (outbound shipment) */
  @Post(':sku/issue')
  async issue(@Param('sku') sku: string, @Body() body: unknown) {
    return this.issueStockCommand.execute(sku, body);
  }

  /** POST /inventory/items/batch/reserve — reserve ALL items for an order atomically */
  @Post('batch/reserve')
  async reserveBatch(@Body() body: unknown) {
    return this.reserveBatchCommand.execute(body);
  }

  /** POST /inventory/items/batch/release — release ALL reserved items for an order */
  @Post('batch/release')
  async releaseBatch(@Body() body: unknown) {
    return this.releaseBatchCommand.execute(body);
  }
}
