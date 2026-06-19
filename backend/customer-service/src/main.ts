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
 * - GET /health, GET /metrics: từ @erp/shared
 *
 * Port: 3001 (cấu hình trong .env)
 * Kiến trúc: DDD 4 layers (domain → application → infrastructure → presentation)
 */
import { NestFactory } from '@nestjs/core';
import { StructuredLogger, CorrelationMiddleware } from '@erp/shared';
import { AppModule } from './app.module';

/** Port mặc định — Customer Service */
const DEFAULT_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Log JSON có correlationId thay cho logger mặc định
    logger: new StructuredLogger(),
  });

  // Correlation middleware toàn cục: đọc/sinh x-correlation-id, chạy request
  // trong ngữ cảnh AsyncLocalStorage → mọi log line tự đính id để truy vết.
  // Đặt ở app.use (Express global) để né các vấn đề matching route wildcard.
  const correlation = new CorrelationMiddleware();
  app.use((req: any, res: any, next: () => void) => correlation.use(req, res, next));

  // CORS — cho phép frontend (Next.js :3000) gọi API
  // Production sẽ đi qua API Gateway, không cần CORS trực tiếp
  app.enableCors();

  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  await app.listen(port);

  console.log(`🚀 Customer Service đang chạy tại http://localhost:${port}`);
  console.log(`📁 Kiến trúc: DDD (domain → application → infrastructure → presentation)`);
  console.log(`📦 Bounded Context: Customer`);
  console.log(`❤️  Health: http://localhost:${port}/health  |  📊 Metrics: http://localhost:${port}/metrics`);
}

bootstrap();
