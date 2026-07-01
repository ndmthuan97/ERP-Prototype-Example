/**
 * Entry point — Customer Service
 *
 * Service này quản lý Bounded Context "Customer" trong kiến trúc DDD:
 * - CRUD khách hàng (tạo, đọc, sửa, xóa mềm)
 * - Kiểm tra tín dụng (credit check) cho Order Service
 * - Publish domain events qua Outbox pattern → Pub/Sub
 *
 * Observability (Phase 2.5):
 * - StructuredLogger: log JSON kèm correlationId (từ @erp/shared)
 * - CorrelationMiddleware: gắn x-correlation-id cho mọi request → truy vết xuyên service
 * - GET /health (readiness) + /health/live (liveness), GET /metrics: từ @erp/shared
 *
 * Hardening (Phase 3):
 * - helmet: security headers
 * - CORS theo whitelist (env CORS_ORIGINS), không mở toàn bộ
 * - ZodExceptionFilter: ZodError → 400 nhất quán toàn cục
 *
 * Port: 3001 (cấu hình trong .env)
 * Kiến trúc: DDD 4 layers (domain → application → infrastructure → presentation)
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

/** Port mặc định — Customer Service */
const DEFAULT_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Log JSON có correlationId thay cho logger mặc định
    logger: new StructuredLogger(),
  });
  const logger = new Logger('Bootstrap');

  // Security headers (CSP, HSTS, X-Frame-Options...) cho mọi response
  app.use(helmet());

  // Correlation middleware toàn cục: đọc/sinh x-correlation-id, chạy request
  // trong ngữ cảnh AsyncLocalStorage → mọi log line tự đính id để truy vết.
  // Đặt ở app.use (Express global) để né các vấn đề matching route wildcard.
  const correlation = new CorrelationMiddleware();
  app.use((req: Request, res: Response, next: () => void) =>
    correlation.use(req, res, next),
  );

  // API versioning: all business routes under /v1, observability at root
  app.setGlobalPrefix('v1', {
    exclude: ['health', 'health/live', 'metrics'],
  });

  // ZodError (validate trong command) → 400 nhất quán cho mọi route
  app.useGlobalFilters(new ZodExceptionFilter());

  // CORS theo whitelist: CORS_ORIGINS="http://localhost:3000,https://app.example.com".
  // Không set → cho phép tất cả (dev). Production NÊN set whitelist hoặc đi qua Gateway.
  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  // OpenAPI / Swagger — served at /docs (UI) and /docs-json (spec).
  // Placed outside the global 'v1' prefix so the docs live at the root path.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Customer Service API')
    .setDescription('Customer bounded context (DDD) — CRUD & credit check.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // nestjs-zod v5: DTO tạo bởi createZodDto cung cấp schema cho @nestjs/swagger khi
  // createDocument; `cleanupOpenApiDoc` hậu xử lý doc để schema Zod hiển thị đúng.
  // (v5 thay cho `patchNestjsSwagger()` của v4 — hàm đó đã bị bỏ.)
  const document = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Customer Service đang chạy tại http://localhost:${port}`);
  logger.log(`📦 Bounded Context: Customer (DDD 4 layers)`);
  logger.log(
    `❤️  Health: /health (readiness) · /health/live (liveness)  |  📊 Metrics: /metrics`,
  );
}

void bootstrap();
