/**
 * Customer Controller — Presentation Layer
 *
 * Controller chỉ làm 1 việc: nhận HTTP request, delegate cho Application layer (Command/Query),
 * trả về response. KHÔNG chứa business logic (Single Responsibility — SOLID "S").
 *
 * Dependency Inversion (SOLID "D"): Controller inject Command/Query (abstraction),
 * không inject trực tiếp Repository hay PrismaService.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

// Import từ Application layer — controller chỉ biết đến use cases, không biết infrastructure
import { CreateCustomerCommand } from '../application/commands/create-customer.command';
import { UpdateCustomerCommand } from '../application/commands/update-customer.command';
import { DeleteCustomerCommand } from '../application/commands/delete-customer.command';
import { GetCustomerQuery } from '../application/queries/get-customer.query';
import { SearchCustomersQuery } from '../application/queries/search-customers.query';
import { CheckCreditQuery } from '../application/queries/check-credit.query';

@Controller('customers')
export class CustomerController {
  constructor(
    // Mỗi use case là 1 class riêng — Interface Segregation (SOLID "I")
    private readonly createCustomerCommand: CreateCustomerCommand,
    private readonly updateCustomerCommand: UpdateCustomerCommand,
    private readonly deleteCustomerCommand: DeleteCustomerCommand,
    private readonly getCustomerQuery: GetCustomerQuery,
    private readonly searchCustomersQuery: SearchCustomersQuery,
    private readonly checkCreditQuery: CheckCreditQuery,
  ) {}

  /**
   * POST /customers — Tạo khách hàng mới
   * Body: { businessName, taxCode?, contactName?, contactPhone?, contactEmail?, creditLimitAmount? }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown) {
    // Validation nằm trong Command (Zod). ZodError được ZodExceptionFilter
    // (toàn cục) dịch thành 400 → controller KHÔNG cần try/catch.
    return this.createCustomerCommand.execute(body);
  }

  /**
   * GET /customers — Tìm kiếm + phân trang
   * Query params: q (search text), page (số trang), limit (số bản ghi/trang)
   */
  @Get()
  async search(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Chỉ parse string → number; việc CLAMP (min/max) + default do SearchCustomersQuery
    // đảm nhiệm (single source of truth) → tránh lặp magic number ở 2 nơi (DRY).
    const pageNumber = Number.parseInt(page ?? '', 10);
    const limitNumber = Number.parseInt(limit ?? '', 10);

    return this.searchCustomersQuery.execute(
      query ?? '',
      Number.isNaN(pageNumber) ? undefined : pageNumber,
      Number.isNaN(limitNumber) ? undefined : limitNumber,
    );
  }

  /**
   * GET /customers/:id — Lấy chi tiết 1 khách hàng
   * Trả về 404 nếu không tìm thấy (xử lý trong Query)
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.getCustomerQuery.execute(id);
  }

  /**
   * PATCH /customers/:id — Cập nhật thông tin khách hàng
   * Chỉ cập nhật các field được gửi trong body (partial update)
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    // Merge id từ URL param vào body — UpdateCommand validate { id, ...fields }.
    // ZodError → ZodExceptionFilter → 400 (không cần try/catch).
    return this.updateCustomerCommand.execute({ id, ...body });
  }

  /**
   * DELETE /customers/:id — Xóa mềm (soft delete)
   * Không xóa thật khỏi DB — chỉ set status = 'archived' và deletedAt = now()
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.deleteCustomerCommand.execute(id);
  }

  /**
   * GET /customers/:id/credit-check — Kiểm tra tín dụng
   * Order Service sẽ gọi endpoint này trước khi xác nhận đơn hàng
   * Trả về: { customerId, creditLimit, creditUsed, available, canOrder }
   */
  @Get(':id/credit-check')
  async checkCredit(@Param('id') id: string) {
    return this.checkCreditQuery.execute(id);
  }
}
