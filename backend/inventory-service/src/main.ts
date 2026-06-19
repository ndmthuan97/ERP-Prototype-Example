import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Khởi động Inventory Service
 * - Port 3003 (hoặc PORT từ env)
 * - Service này quản lý bounded context "Inventory":
 *   + Quản lý items, warehouses, stock levels
 *   + Optimistic locking khi cập nhật stock (tránh race condition)
 *   + Reserve / release stock (phối hợp với Order Service qua Saga)
 *   + Movement log — ghi lại mọi thay đổi stock
 *   + Phát event qua Pub/Sub (outbox pattern)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lấy port từ biến môi trường, mặc định 3003
  const port = process.env.INVENTORY_SERVICE_PORT ?? 3003;

  await app.listen(port);
  console.log(`🟢 Inventory Service đang chạy tại: http://localhost:${port}`);
}
bootstrap();
