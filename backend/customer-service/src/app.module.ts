/**
 * AppModule — Root module của Customer Service
 *
 * Module này wire up toàn bộ Dependency Injection (DI) container theo SOLID.
 *
 * Sau Phase 2.5: phần hạ tầng dùng chung (Outbox Worker, Pub/Sub Publisher,
 * Redis Cache, Metrics, Health) được import từ @erp/shared — KHÔNG còn nằm
 * cục bộ trong service này (DRY). Service chỉ cung cấp các "adapter" mỏng
 * gắn vào abstraction của shared (vd: PrismaOutboxStore implement OutboxStore).
 *
 * Dependency Inversion (SOLID "D"):
 *   - CUSTOMER_REPOSITORY token → PrismaCustomerRepository
 *   - OUTBOX_STORE token → PrismaOutboxStore (worker generic dùng qua interface)
 *   - Command/Query inject interface, không inject implementation trực tiếp
 */
import { Module } from '@nestjs/common';

// === Hạ tầng dùng chung từ @erp/shared ===
import {
  RedisCacheService,
  PubSubPublisher,
  OutboxWorkerService,
  OUTBOX_STORE,
  MetricsService,
  MetricsController,
  HealthController,
  HEALTH_INDICATORS,
  type HealthIndicator,
} from '@erp/shared';

// === Infrastructure cục bộ của service ===
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaCustomerRepository } from './infrastructure/persistence/customer.repository.impl';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox.store';

// === Domain — chỉ import token, không import class cụ thể ===
import { CUSTOMER_REPOSITORY } from './domain/repositories/customer.repository';

// === Application — use cases (Command = ghi, Query = đọc → CQRS) ===
import { CreateCustomerCommand } from './application/commands/create-customer.command';
import { UpdateCustomerCommand } from './application/commands/update-customer.command';
import { DeleteCustomerCommand } from './application/commands/delete-customer.command';
import { GetCustomerQuery } from './application/queries/get-customer.query';
import { SearchCustomersQuery } from './application/queries/search-customers.query';
import { CheckCreditQuery } from './application/queries/check-credit.query';

// === Presentation — HTTP controllers ===
import { CustomerController } from './presentation/customer.controller';

@Module({
  controllers: [
    CustomerController,
    // /health và /metrics đến từ @erp/shared — dùng chung mọi service
    HealthController,
    MetricsController,
  ],
  providers: [
    // === Infrastructure ===
    PrismaService,

    // Repository — Dependency Inversion: inject bằng token, không bằng class
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },

    // Cache + Metrics dùng chung từ shared
    RedisCacheService,
    MetricsService,

    // --- Outbox: worker generic (shared) + store cụ thể (local) ---
    // PrismaOutboxStore implement OutboxStore → bind vào token OUTBOX_STORE
    // để OutboxWorkerService (không biết Prisma) dùng được.
    PrismaOutboxStore,
    PubSubPublisher,
    {
      provide: OUTBOX_STORE,
      useExisting: PrismaOutboxStore,
    },
    OutboxWorkerService,

    // --- Health indicators: service tự khai báo các mục cần kiểm tra ---
    // HealthController (shared) chỉ biết interface HealthIndicator[], không
    // biết Prisma/Redis cụ thể → service cung cấp qua factory.
    {
      provide: HEALTH_INDICATORS,
      useFactory: (
        prisma: PrismaService,
        cache: RedisCacheService,
      ): HealthIndicator[] => [
        {
          name: 'postgres',
          check: async () => {
            // Ping DB bằng query rẻ nhất — kết nối OK nếu không throw
            await prisma.$queryRaw`SELECT 1`;
            return true;
          },
        },
        {
          name: 'redis',
          check: () => cache.ping(),
        },
      ],
      inject: [PrismaService, RedisCacheService],
    },

    // === Application — Use Cases ===
    CreateCustomerCommand,
    UpdateCustomerCommand,
    DeleteCustomerCommand,
    GetCustomerQuery,
    SearchCustomersQuery,
    CheckCreditQuery,
  ],
})
export class AppModule {}
