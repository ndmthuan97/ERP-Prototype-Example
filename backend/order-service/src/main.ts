import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Khởi động Order Service
 * - Port 3002 (hoặc PORT từ env)
 * - Service này quản lý bounded context "Order":
 *   + Tạo đơn hàng (Order Header + Order Lines) — Aggregate Root pattern
 *   + Quản lý lifecycle: draft → submitted → confirmed → fulfilled / cancelled
 *   + Saga orchestration: submit → reserve stock → credit check → confirm
 *   + CQRS: tách model ghi (headers) và đọc (lifecycle_view)
 *   + Phát event qua Pub/Sub (outbox pattern)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lấy port từ biến môi trường, mặc định 3002
  const port = process.env.ORDER_SERVICE_PORT ?? 3002;

  await app.listen(port);
  console.log(`🟢 Order Service đang chạy tại: http://localhost:${port}`);
}
bootstrap();
