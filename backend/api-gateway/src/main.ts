import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Khởi động API Gateway
 * - Port 3010 (hoặc PORT từ env)
 * - Gateway là ĐIỂM VÀO DUY NHẤT cho frontend:
 *   + Frontend chỉ biết 1 URL: http://localhost:3010
 *   + Gateway nhận request → verify JWT → check role → forward đến service đúng
 *   + Public routes (login, refresh): forward thẳng không cần JWT
 *   + Protected routes: verify JWT trước, gắn x-user-id + x-user-role vào header khi forward
 *   + Routing:
 *     /api/auth/*       → Auth Service :3004
 *     /api/customers/*  → Customer Service :3001
 *     /api/orders/*     → Order Service :3002
 *     /api/inventory/*  → Inventory Service :3003
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật CORS để frontend (port 3000) có thể gọi gateway (port 3010)
  // Trong production sẽ cấu hình origin cụ thể thay vì true
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Đặt prefix /api cho tất cả routes
  // → tất cả endpoint sẽ bắt đầu bằng /api/...
  app.setGlobalPrefix('api');

  // Lấy port từ biến môi trường, mặc định 3010
  const port = process.env.API_GATEWAY_PORT ?? 3010;

  await app.listen(port);
  console.log(`🟢 API Gateway đang chạy tại: http://localhost:${port}`);
  console.log(`📋 Routing:`);
  console.log(`   /api/auth/*       → Auth Service :3004`);
  console.log(`   /api/customers/*  → Customer Service :3001`);
  console.log(`   /api/orders/*     → Order Service :3002`);
  console.log(`   /api/inventory/*  → Inventory Service :3003`);
}
bootstrap();
