/**
 * Entry point — Customer Service
 *
 * Service này quản lý Bounded Context "Customer" trong kiến trúc DDD:
 * - CRUD khách hàng (tạo, đọc, sửa, xóa mềm)
 * - Kiểm tra tín dụng (credit check) cho Order Service
 * - Publish domain events qua Outbox pattern → Pub/Sub
 *
 * Port: 3001 (cấu hình trong .env)
 * Kiến trúc: DDD 4 layers (domain → application → infrastructure → presentation)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** Port mặc định — Customer Service */
const DEFAULT_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — cho phép frontend (Next.js :3000) gọi API
  // Production sẽ đi qua API Gateway, không cần CORS trực tiếp
  app.enableCors();

  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  await app.listen(port);

  console.log(`🚀 Customer Service đang chạy tại http://localhost:${port}`);
  console.log(`📁 Kiến trúc: DDD (domain → application → infrastructure → presentation)`);
  console.log(`📦 Bounded Context: Customer`);
}

bootstrap();
