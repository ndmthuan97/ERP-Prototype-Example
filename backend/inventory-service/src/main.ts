/**
 * Entry point — Inventory Service
 *
 * Bounded Context "Inventory": quản lý tồn kho theo SKU với OPTIMISTIC LOCKING.
 * - REST: tạo item, nhập kho, reserve/release (saga), kiểm tra tồn.
 * - Outbox → Pub/Sub: inventory.reserved / inventory.released.
 * Port: 3003
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { StructuredLogger, CorrelationMiddleware } from '@erp/shared';
import { AppModule } from './app.module';
import { ZodExceptionFilter } from './common/zod-exception.filter';

const DEFAULT_PORT = 3003;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  const correlation = new CorrelationMiddleware();
  app.use((req: Request, res: Response, next: () => void) =>
    correlation.use(req, res, next),
  );

  app.useGlobalFilters(new ZodExceptionFilter());

  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  const port = parseInt(
    process.env.PORT ||
      process.env.INVENTORY_SERVICE_PORT ||
      String(DEFAULT_PORT),
    10,
  );
  await app.listen(port);

  logger.log(`🚀 Inventory Service đang chạy tại http://localhost:${port}`);
  logger.log(`📦 Bounded Context: Inventory (Optimistic Locking)`);
  logger.log(
    `❤️  Health: /health (readiness) · /health/live  |  📊 Metrics: /metrics`,
  );
}

void bootstrap();
