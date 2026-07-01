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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
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

  // API versioning: all business routes under /v1, observability at root
  app.setGlobalPrefix('v1', {
    exclude: ['health', 'health/live', 'metrics'],
  });

  app.useGlobalFilters(new ZodExceptionFilter());

  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  // OpenAPI / Swagger — served at /docs (UI) and /docs-json (spec).
  // Placed outside the global 'v1' prefix so the docs live at the root path.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inventory Service API')
    .setDescription('Inventory bounded context (DDD) — stock & optimistic locking.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // nestjs-zod v5: DTOs built with createZodDto are picked up by the swagger
  // CLI plugin; cleanupOpenApiDoc() post-processes the Zod-generated schemas
  // (fills components.schemas with real body shapes) after createDocument.
  const document = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(
    process.env.PORT ||
      process.env.INVENTORY_SERVICE_PORT ||
      String(DEFAULT_PORT),
    10,
  );
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Inventory Service đang chạy tại http://localhost:${port}`);
  logger.log(`📦 Bounded Context: Inventory (Optimistic Locking)`);
  logger.log(
    `❤️  Health: /health (readiness) · /health/live  |  📊 Metrics: /metrics`,
  );
}

void bootstrap();
