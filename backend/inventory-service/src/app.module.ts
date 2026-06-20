/**
 * AppModule — Inventory Service
 *
 * Wire DI theo SOLID, dùng hạ tầng chung từ @erp/shared (Outbox Worker, Pub/Sub,
 * Metrics, Health). Inventory KHÔNG dùng Redis cache (tồn kho cần số liệu chính
 * xác tức thời) → health chỉ kiểm tra Postgres.
 */
import { Module } from '@nestjs/common';

import {
  PubSubPublisher,
  OutboxWorkerService,
  OUTBOX_STORE,
  MetricsService,
  MetricsController,
  HealthController,
  HEALTH_INDICATORS,
  type HealthIndicator,
} from '@erp/shared';

import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaStockItemRepository } from './infrastructure/persistence/stock-item.repository.impl';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox.store';

import { STOCK_ITEM_REPOSITORY } from './domain/repositories/stock-item.repository';

import { CreateItemCommand } from './application/commands/create-item.command';
import { ReceiveStockCommand } from './application/commands/receive-stock.command';
import { ReserveStockCommand } from './application/commands/reserve-stock.command';
import { ReleaseStockCommand } from './application/commands/release-stock.command';
import { GetItemQuery } from './application/queries/get-item.query';
import { SearchItemsQuery } from './application/queries/search-items.query';
import { CheckAvailabilityQuery } from './application/queries/check-availability.query';

import { InventoryController } from './presentation/inventory.controller';

@Module({
  controllers: [InventoryController, HealthController, MetricsController],
  providers: [
    PrismaService,

    {
      provide: STOCK_ITEM_REPOSITORY,
      useClass: PrismaStockItemRepository,
    },

    MetricsService,

    // Outbox: store cục bộ (Prisma) + worker generic (shared)
    PrismaOutboxStore,
    PubSubPublisher,
    {
      provide: OUTBOX_STORE,
      useExisting: PrismaOutboxStore,
    },
    OutboxWorkerService,

    // Health: chỉ kiểm tra Postgres
    {
      provide: HEALTH_INDICATORS,
      useFactory: (prisma: PrismaService): HealthIndicator[] => [
        {
          name: 'postgres',
          check: async () => {
            await prisma.$queryRaw`SELECT 1`;
            return true;
          },
        },
      ],
      inject: [PrismaService],
    },

    // Use cases
    CreateItemCommand,
    ReceiveStockCommand,
    ReserveStockCommand,
    ReleaseStockCommand,
    GetItemQuery,
    SearchItemsQuery,
    CheckAvailabilityQuery,
  ],
})
export class AppModule {}
