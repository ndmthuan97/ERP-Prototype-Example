/**
 * Entry point — Purchasing Service
 *
 * Bounded Context "Purchasing" in DDD architecture:
 * - CRUD purchase orders (create draft, add/remove lines, place, receive, cancel)
 * - Publish domain events via Outbox pattern → Pub/Sub
 *
 * Port: 3006
 * Architecture: DDD 4 layers (domain → application → infrastructure → presentation)
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { StructuredLogger, CorrelationMiddleware } from '@erp/shared';
import { AppModule } from './app.module';
import { ZodExceptionFilter } from './common/zod-exception.filter';
import { DomainExceptionFilter } from './common/domain-exception.filter';

const DEFAULT_PORT = 3006;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });
  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(helmet());

  // Correlation middleware: propagate x-correlation-id across services
  const correlation = new CorrelationMiddleware();
  app.use((req: Request, res: Response, next: () => void) =>
    correlation.use(req, res, next),
  );

  // API versioning: all business routes under /v1, observability at root
  app.setGlobalPrefix('v1', {
    exclude: ['health', 'health/live', 'metrics'],
  });

  // Global exception filters
  app.useGlobalFilters(
    new ZodExceptionFilter(),
    new DomainExceptionFilter(),
  );

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Purchasing Service running at http://localhost:${port}`);
  logger.log(`📦 Bounded Context: Purchasing (DDD 4 layers)`);
  logger.log(
    `❤️  Health: /health (readiness) · /health/live (liveness)  |  📊 Metrics: /metrics`,
  );
}

void bootstrap();
