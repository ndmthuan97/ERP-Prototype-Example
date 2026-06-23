// =============================================================================
// Entry point — Catalog Service
// =============================================================================
// Manages the "Catalog" bounded context (DDD 4 layers).
// Port: 3005 (configurable via .env)

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { StructuredLogger, CorrelationMiddleware } from '@erp/shared';
import { AppModule } from './app.module';
import { ZodExceptionFilter } from './common/zod-exception.filter';

const DEFAULT_PORT = 3005;

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

  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Catalog Service running at http://localhost:${port}`);
  logger.log(`📦 Bounded Context: Catalog (DDD 4 layers)`);
  logger.log(
    `❤️  Health: /health (readiness) · /health/live (liveness)  |  📊 Metrics: /metrics`,
  );
}

void bootstrap();
