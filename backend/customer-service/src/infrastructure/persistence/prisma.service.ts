/**
 * PrismaService — Quản lý kết nối database (Infrastructure Layer)
 *
 * Prisma v7 yêu cầu sử dụng Driver Adapter thay vì url trong schema.prisma.
 * PrismaPg adapter cung cấp kết nối trực tiếp tới PostgreSQL.
 *
 * Lifecycle:
 *   - onModuleInit: kết nối DB khi NestJS module khởi tạo
 *   - onModuleDestroy: ngắt kết nối khi module bị destroy (graceful shutdown)
 *
 * Global scope: được đánh dấu @Global() để các module khác inject được
 * mà không cần import lại.
 */
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Global,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
// Helper lấy connection string dùng chung mọi service (@erp/shared) — DRY
import { resolveConnectionString } from '@erp/shared';

@Global()
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma v7: tạo adapter với connection string từ environment.
    // Adapter quản lý connection pool thay vì Prisma quản lý trực tiếp.
    // Logic chọn RUNTIME_DATABASE_URL (pooled) / DATABASE_URL (direct) đã rút lên
    // @erp/shared (resolveConnectionString) — mọi service dùng chung, không lặp.
    const adapter = new PrismaPg({
      connectionString: resolveConnectionString(),
    });

    // Truyền adapter vào PrismaClient — Prisma v7 bắt buộc
    super({ adapter });
  }

  /**
   * Kết nối database khi NestJS module khởi tạo.
   * NestJS tự động gọi method này nhờ implement OnModuleInit.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Ngắt kết nối khi module bị destroy.
   * Đảm bảo không leak connection khi service shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
