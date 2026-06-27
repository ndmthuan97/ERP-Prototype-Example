/**
 * AppModule — Root module of Purchasing Service
 *
 * Wires up DI container following SOLID principles.
 * Infrastructure shared modules (Outbox Worker, Pub/Sub Publisher,
 * Redis Cache, Metrics, Health) imported from @erp/shared.
 */
import { Module } from '@nestjs/common';

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

// Infrastructure (local)
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaPurchaseOrderRepository } from './infrastructure/persistence/purchase-order.repository.impl';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox.store';
import { PrismaSupplierRepository } from './infrastructure/persistence/prisma-supplier.repository';

// Domain — token only
import { PURCHASE_ORDER_REPOSITORY } from './domain/repositories/purchase-order.repository';
import { SUPPLIER_REPOSITORY } from './domain/repositories/supplier.repository';

// Application — use cases (Command = write, Query = read → CQRS)
import { CreatePOCommand } from './application/commands/create-po.command';
import { AddLinePOCommand } from './application/commands/add-line-po.command';
import { RemoveLinePOCommand } from './application/commands/remove-line-po.command';
import { PlacePOCommand } from './application/commands/place-po.command';
import { ReceiveGoodsCommand } from './application/commands/receive-goods.command';
import { CancelPOCommand } from './application/commands/cancel-po.command';
import { CreateSupplierCommand } from './application/commands/create-supplier.command';
import { UpdateSupplierCommand } from './application/commands/update-supplier.command';
import { GetPOQuery } from './application/queries/get-po.query';
import { SearchPOsQuery } from './application/queries/search-pos.query';
import { GetSupplierQuery } from './application/queries/get-supplier.query';
import { SearchSuppliersQuery } from './application/queries/search-suppliers.query';

// Presentation — HTTP controllers
import { PurchasingController } from './presentation/purchasing.controller';
import { SupplierController } from './presentation/supplier.controller';

@Module({
  controllers: [
    PurchasingController,
    SupplierController,
    HealthController,
    MetricsController,
  ],
  providers: [
    // === Infrastructure ===
    PrismaService,

    // Repository — Dependency Inversion: inject by token, not class
    {
      provide: PURCHASE_ORDER_REPOSITORY,
      useClass: PrismaPurchaseOrderRepository,
    },
    {
      provide: SUPPLIER_REPOSITORY,
      useClass: PrismaSupplierRepository,
    },

    // Cache + Metrics from shared
    RedisCacheService,
    MetricsService,

    // --- Outbox: generic worker (shared) + local store ---
    PrismaOutboxStore,
    PubSubPublisher,
    {
      provide: OUTBOX_STORE,
      useExisting: PrismaOutboxStore,
    },
    OutboxWorkerService,

    // --- Health indicators ---
    {
      provide: HEALTH_INDICATORS,
      useFactory: (
        prisma: PrismaService,
        cache: RedisCacheService,
      ): HealthIndicator[] => [
        {
          name: 'postgres',
          check: async () => {
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
    CreatePOCommand,
    AddLinePOCommand,
    RemoveLinePOCommand,
    PlacePOCommand,
    ReceiveGoodsCommand,
    CancelPOCommand,
    CreateSupplierCommand,
    UpdateSupplierCommand,
    GetPOQuery,
    SearchPOsQuery,
    GetSupplierQuery,
    SearchSuppliersQuery,
  ],
})
export class AppModule {}
