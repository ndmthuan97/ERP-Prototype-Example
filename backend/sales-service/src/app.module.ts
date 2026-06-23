/**
 * AppModule — Sales Service
 *
 * Wire DI theo SOLID, dùng hạ tầng chung từ @erp/shared (Outbox Worker, Pub/Sub,
 * Metrics, Health, PubSubSubscriber). Order-service là service ĐẦU TIÊN có cả
 * publisher LẪN subscriber (saga choreography).
 */
import { Module } from '@nestjs/common';

import {
  PubSubPublisher,
  PubSubSubscriber,
  OutboxWorkerService,
  OUTBOX_STORE,
  MetricsService,
  MetricsController,
  HealthController,
  HEALTH_INDICATORS,
  type HealthIndicator,
} from '@erp/shared';

import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaSalesOrderRepository } from './infrastructure/persistence/sales-order.repository.impl';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox.store';
import { SalesEventSubscriber } from './infrastructure/messaging/sales-event.subscriber';
import { CustomerClient } from './infrastructure/http/customer-client';

import { SALES_ORDER_REPOSITORY } from './domain/repositories/sales-order.repository';

import { CreateSalesOrderCommand } from './application/commands/create-sales-order.command';
import { AddLineCommand } from './application/commands/add-line.command';
import { SubmitSalesOrderCommand } from './application/commands/submit-sales-order.command';
import { CancelSalesOrderCommand } from './application/commands/cancel-sales-order.command';
import { HandleInventoryReservedCommand } from './application/commands/handle-inventory-reserved.command';
import { HandleReservationFailedCommand } from './application/commands/handle-reservation-failed.command';
import { FulfilSalesOrderCommand } from './application/commands/fulfil-sales-order.command';
import { GetSalesOrderQuery } from './application/queries/get-sales-order.query';
import { SearchSalesOrdersQuery } from './application/queries/search-sales-orders.query';
import { GetLifecycleQuery } from './application/queries/get-lifecycle.query';

import { SalesOrderController } from './presentation/sales-order.controller';

@Module({
  controllers: [SalesOrderController, HealthController, MetricsController],
  providers: [
    PrismaService,

    {
      provide: SALES_ORDER_REPOSITORY,
      useClass: PrismaSalesOrderRepository,
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

    // Pub/Sub Subscriber (saga events from inventory)
    PubSubSubscriber,
    SalesEventSubscriber,

    // HTTP client for credit-check
    CustomerClient,

    // Health: kiểm tra Postgres
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

    // Commands (ghi)
    CreateSalesOrderCommand,
    AddLineCommand,
    SubmitSalesOrderCommand,
    CancelSalesOrderCommand,
    HandleInventoryReservedCommand,
    HandleReservationFailedCommand,
    FulfilSalesOrderCommand,

    // Queries (đọc)
    GetSalesOrderQuery,
    SearchSalesOrdersQuery,
    GetLifecycleQuery,
  ],
})
export class AppModule {}
