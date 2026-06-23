// =============================================================================
// APP MODULE — Root module of Catalog Service
// =============================================================================

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

import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaProductRepository } from './infrastructure/persistence/product.repository.impl';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox.store';

import { PRODUCT_REPOSITORY } from './domain/repositories/product.repository';

import { CreateProductCommand } from './application/commands/create-product.command';
import { UpdateProductCommand } from './application/commands/update-product.command';
import { DeactivateProductCommand } from './application/commands/deactivate-product.command';
import { ActivateProductCommand } from './application/commands/activate-product.command';
import { GetProductQuery } from './application/queries/get-product.query';
import { SearchProductsQuery } from './application/queries/search-products.query';

import { CatalogController } from './presentation/catalog.controller';

@Module({
  controllers: [
    CatalogController,
    HealthController,
    MetricsController,
  ],
  providers: [
    // === Infrastructure ===
    PrismaService,

    // Repository — Dependency Inversion
    {
      provide: PRODUCT_REPOSITORY,
      useClass: PrismaProductRepository,
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
    CreateProductCommand,
    UpdateProductCommand,
    DeactivateProductCommand,
    ActivateProductCommand,
    GetProductQuery,
    SearchProductsQuery,
  ],
})
export class AppModule {}
