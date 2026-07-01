/**
 * Entry point — Auth Service
 *
 * Service manages the Auth Bounded Context in DDD architecture:
 * - User registration (admin-only)
 * - Login with email/password → JWT tokens
 * - Refresh token rotation
 * - JWT verification for API Gateway
 *
 * Port: 3004 (configured in .env)
 * Architecture: DDD 4 layers (domain → application → infrastructure → presentation)
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { StructuredLogger, CorrelationMiddleware } from '@erp/shared';
import { AppModule } from './app.module.js';
import { ZodExceptionFilter } from './common/zod-exception.filter.js';
import { DomainExceptionFilter } from './common/domain-exception.filter.js';

const DEFAULT_PORT = 3004;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });
  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(helmet());

  // Correlation middleware — attach x-correlation-id for distributed tracing
  const correlation = new CorrelationMiddleware();
  app.use((req: Request, res: Response, next: () => void) =>
    correlation.use(req, res, next),
  );

  // API versioning: all business routes under /v1, observability at root
  app.setGlobalPrefix('v1', {
    exclude: ['health', 'health/live', 'metrics'],
  });

  // Global exception filters
  app.useGlobalFilters(new ZodExceptionFilter(), new DomainExceptionFilter());

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  // OpenAPI / Swagger — served at /docs (UI) and /docs-json (spec).
  // Placed outside the global 'v1' prefix so the docs live at the root path.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription('Authentication & Authorization bounded context (DDD).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // nestjs-zod v5: createZodDto DTOs expose their schema to @nestjs/swagger at
  // createDocument time; `cleanupOpenApiDoc` post-processes the generated doc so
  // the Zod-derived request/response schemas render correctly. (v5 replaces the
  // old v4 `patchNestjsSwagger()` — that function no longer exists.)
  const document = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(
    process.env.PORT || process.env.AUTH_SERVICE_PORT || String(DEFAULT_PORT),
    10,
  );
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Auth Service running at http://localhost:${port}`);
  logger.log(`🔐 Bounded Context: Auth (DDD 4 layers)`);
  logger.log(
    `❤️  Health: /health (readiness) · /health/live (liveness)  |  📊 Metrics: /metrics`,
  );
}

void bootstrap();
