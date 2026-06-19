import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Khởi động Auth Service
 * - Port 3004 (hoặc PORT từ env)
 * - Service này quản lý authentication & authorization:
 *   + Đăng ký user (chỉ admin được tạo)
 *   + Đăng nhập (email + password) → trả JWT token
 *   + Refresh token — cấp lại access token khi hết hạn
 *   + Verify JWT — API Gateway gọi để kiểm tra token
 *   + Hash password bằng bcrypt, sign JWT bằng jsonwebtoken
 *   + 3 roles: admin (full quyền), manager (CRUD + approve), staff (xem + tạo)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lấy port từ biến môi trường, mặc định 3004
  const port = process.env.AUTH_SERVICE_PORT ?? 3004;

  await app.listen(port);
  console.log(`🟢 Auth Service đang chạy tại: http://localhost:${port}`);
}
bootstrap();
