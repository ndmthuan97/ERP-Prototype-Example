// =============================================================================
// SUPPLIER CONTROLLER — REST endpoints for supplier management
// =============================================================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { CreateSupplierCommand, UpdateSupplierCommand } from '../application/commands/index.js';
import { GetSupplierQuery, SearchSuppliersQuery } from '../application/queries/index.js';

@Controller('suppliers')
export class SupplierController {
  constructor(
    private readonly createSupplierCommand: CreateSupplierCommand,
    private readonly updateSupplierCommand: UpdateSupplierCommand,
    private readonly getSupplierQuery: GetSupplierQuery,
    private readonly searchSuppliersQuery: SearchSuppliersQuery,
  ) {}

  /** POST /suppliers — Create a new supplier */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    return this.createSupplierCommand.execute(body);
  }

  /** GET /suppliers — List suppliers with search + pagination */
  @Get()
  async search(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isActive') isActive?: string,
  ) {
    const pageNumber = Number.parseInt(page ?? '', 10);
    const limitNumber = Number.parseInt(limit ?? '', 10);
    const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    return this.searchSuppliersQuery.execute(
      query,
      Number.isNaN(pageNumber) ? undefined : pageNumber,
      Number.isNaN(limitNumber) ? undefined : limitNumber,
      activeFilter,
    );
  }

  /** GET /suppliers/:id — Get supplier detail */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.getSupplierQuery.execute(id);
  }

  /** PATCH /suppliers/:id — Update a supplier */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.updateSupplierCommand.execute(id, body);
  }
}
