/**
 * AppModule — Order Service
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
import { PrismaOrderRepository } from './infrastructure/persistence/order.repository.impl';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox.store';
import { OrderEventSubscriber } from './infrastructure/messaging/order-event.subscriber';
import { CustomerClient } from './infrastructure/http/customer-client';

import { ORDER_REPOSITORY } from './domain/repositories/order.repository';

import { CreateOrderCommand } from './application/commands/create-order.command';
import { AddLineCommand } from './application/commands/add-line.command';
import { SubmitOrderCommand } from './application/commands/submit-order.command';
import { CancelOrderCommand } from './application/commands/cancel-order.command';
import { HandleInventoryReservedCommand } from './application/commands/handle-inventory-reserved.command';
import { HandleReservationFailedCommand } from './application/commands/handle-reservation-failed.command';
import { GetOrderQuery } from './application/queries/get-order.query';
import { SearchOrdersQuery } from './application/queries/search-orders.query';
import { GetLifecycleQuery } from './application/queries/get-lifecycle.query';

import { OrderController } from './presentation/order.controller';

@Module({
  controllers: [OrderController, HealthController, MetricsController],
  providers: [
    PrismaService,

    {
      provide: ORDER_REPOSITORY,
      useClass: PrismaOrderRepository,
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
    OrderEventSubscriber,

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
    CreateOrderCommand,
    AddLineCommand,
    SubmitOrderCommand,
    CancelOrderCommand,
    HandleInventoryReservedCommand,
    HandleReservationFailedCommand,

    // Queries (đọc)
    GetOrderQuery,
    SearchOrdersQuery,
    GetLifecycleQuery,
  ],
})
export class AppModule {}
