/**
 * AppModule — Root module của Customer Service
 *
 * Module này wire up toàn bộ Dependency Injection (DI) container theo nguyên tắc SOLID:
 *
 * Dependency Inversion (SOLID "D"):
 *   - CUSTOMER_REPOSITORY token → PrismaCustomerRepository
 *   - Command/Query inject interface, không inject implementation trực tiếp
 *
 * Single Responsibility (SOLID "S"):
 *   - Module chỉ làm 1 việc: đăng ký providers và controllers
 *   - Mỗi provider có 1 trách nhiệm riêng biệt
 *
 * Interface Segregation (SOLID "I"):
 *   - Command tách biệt Query (CQRS)
 *   - Repository tách biệt Cache, Messaging
 */
import { Module } from '@nestjs/common';

// Infrastructure — implementations cụ thể
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaCustomerRepository } from './infrastructure/persistence/customer.repository.impl';
import { OutboxWorkerService } from './infrastructure/messaging/outbox-worker.service';
import { RedisCacheService } from './infrastructure/cache/redis-cache.service';

// Domain — chỉ import token constant, không import class cụ thể
import { CUSTOMER_REPOSITORY } from './domain/repositories/customer.repository';

// Application — use cases (Command = ghi, Query = đọc → CQRS)
import { CreateCustomerCommand } from './application/commands/create-customer.command';
import { UpdateCustomerCommand } from './application/commands/update-customer.command';
import { DeleteCustomerCommand } from './application/commands/delete-customer.command';
import { GetCustomerQuery } from './application/queries/get-customer.query';
import { SearchCustomersQuery } from './application/queries/search-customers.query';
import { CheckCreditQuery } from './application/queries/check-credit.query';

// Presentation — HTTP controllers
import { CustomerController } from './presentation/customer.controller';

@Module({
  controllers: [
    // Controller chỉ nhận request, delegate cho Command/Query
    CustomerController,
  ],
  providers: [
    // === Infrastructure ===

    // PrismaService — quản lý connection pool đến PostgreSQL
    PrismaService,

    // Repository — Dependency Inversion: inject bằng token, không bằng class
    // Khi code khác inject @Inject(CUSTOMER_REPOSITORY), NestJS sẽ cung cấp PrismaCustomerRepository
    // Muốn đổi sang MongoDB → chỉ cần thay useClass, KHÔNG sửa code Command/Query
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },

    // Outbox Worker — poll bảng outbox, publish event lên Pub/Sub
    OutboxWorkerService,

    // Redis Cache — cache kết quả query để giảm tải DB
    RedisCacheService,

    // === Application — Use Cases ===

    // Commands (ghi) — mỗi command = 1 use case duy nhất (Single Responsibility)
    CreateCustomerCommand,
    UpdateCustomerCommand,
    DeleteCustomerCommand,

    // Queries (đọc) — tách biệt với Commands → CQRS pattern
    GetCustomerQuery,
    SearchCustomersQuery,
    CheckCreditQuery,
  ],
})
export class AppModule {}
