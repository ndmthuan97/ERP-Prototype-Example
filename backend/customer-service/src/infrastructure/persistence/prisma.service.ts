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
import { Injectable, OnModuleInit, OnModuleDestroy, Global } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Global()
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma v7: tạo adapter với connection string từ environment
    // Adapter quản lý connection pool thay vì Prisma quản lý trực tiếp
    // RUNTIME_DATABASE_URL (port 6543, pooled) cho app runtime
    // Fallback sang DATABASE_URL (port 5432, direct) nếu chưa set
    const connectionString = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL chưa được set trong environment');
    }

    const adapter = new PrismaPg({ connectionString });

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
