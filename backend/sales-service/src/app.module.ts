/**
 * AppModule — Sales Service
 *
 * Wire DI theo SOLID, dùng hạ tầng chung từ @erp/shared (Outbox Worker, Pub/Sub,
 * Metrics, Health). Uses synchronous HTTP for reserve (InventoryClient) and
 * credit-check (CustomerClient). Pub/Sub is used only for publishing events.
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
import { PrismaSalesOrderRepository } from './infrastructure/persistence/sales-order.repository.impl';
import { PrismaDeliveryOrderRepository } from './infrastructure/persistence/delivery-order.repository.impl';
import { PrismaSalesReturnRepository } from './infrastructure/persistence/sales-return.repository.impl';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox.store';
import { CustomerClient } from './infrastructure/http/customer-client';
import { InventoryClient } from './infrastructure/http/inventory-client';

import { SALES_ORDER_REPOSITORY } from './domain/repositories/sales-order.repository';
import { DELIVERY_ORDER_REPOSITORY } from './domain/repositories/delivery-order.repository';
import { SALES_RETURN_REPOSITORY } from './domain/repositories/sales-return.repository';

import { CreateSalesOrderCommand } from './application/commands/create-sales-order.command';
import { AddLineCommand } from './application/commands/add-line.command';
import { SubmitSalesOrderCommand } from './application/commands/submit-sales-order.command';
import { CancelSalesOrderCommand } from './application/commands/cancel-sales-order.command';
import { FulfilSalesOrderCommand } from './application/commands/fulfil-sales-order.command';
import { CreateDeliveryOrderCommand } from './application/commands/create-delivery-order.command';
import { UpdateDeliveryStatusCommand } from './application/commands/update-delivery-status.command';
import { HandleDeliveryCompletedCommand } from './application/commands/handle-delivery-completed.command';
import { CreateSalesReturnCommand } from './application/commands/create-sales-return.command';
import { UpdateSalesReturnStatusCommand } from './application/commands/update-sales-return-status.command';
import { GetSalesOrderQuery } from './application/queries/get-sales-order.query';
import { SearchSalesOrdersQuery } from './application/queries/search-sales-orders.query';
import { GetLifecycleQuery } from './application/queries/get-lifecycle.query';
import { GetDeliveryOrdersQuery } from './application/queries/get-delivery-orders.query';
import { GetSalesReturnsQuery } from './application/queries/get-sales-returns.query';

import { SalesOrderController } from './presentation/sales-order.controller';
import { DeliveryController } from './presentation/delivery.controller';
import { ReturnController } from './presentation/return.controller';

@Module({
  controllers: [
    SalesOrderController,
    DeliveryController,
    ReturnController,
    HealthController,
    MetricsController,
  ],
  providers: [
    PrismaService,

    {
      provide: SALES_ORDER_REPOSITORY,
      useClass: PrismaSalesOrderRepository,
    },
    {
      provide: DELIVERY_ORDER_REPOSITORY,
      useClass: PrismaDeliveryOrderRepository,
    },
    {
      provide: SALES_RETURN_REPOSITORY,
      useClass: PrismaSalesReturnRepository,
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

    // HTTP clients for synchronous cross-service calls
    CustomerClient,
    InventoryClient,

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
    FulfilSalesOrderCommand,
    CreateDeliveryOrderCommand,
    UpdateDeliveryStatusCommand,
    HandleDeliveryCompletedCommand,
    CreateSalesReturnCommand,
    UpdateSalesReturnStatusCommand,

    // Queries (đọc)
    GetSalesOrderQuery,
    SearchSalesOrdersQuery,
    GetLifecycleQuery,
    GetDeliveryOrdersQuery,
    GetSalesReturnsQuery,
  ],
})
export class AppModule {}
