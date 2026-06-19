import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Khởi động Customer Service
 * - Port 3001 (hoặc PORT từ env)
 * - Service này quản lý bounded context "Customer":
 *   + CRUD khách hàng
 *   + Kiểm tra tín dụng (credit check)
 *   + Phát event qua Pub/Sub khi có thay đổi
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lấy port từ biến môi trường, mặc định 3001
  // Mỗi service chạy port riêng để không conflict
  const port = process.env.CUSTOMER_SERVICE_PORT ?? 3001;

  await app.listen(port);

  // Log ra console để biết service đã sẵn sàng
  console.log(`🟢 Customer Service đang chạy tại: http://localhost:${port}`);
}
bootstrap();
