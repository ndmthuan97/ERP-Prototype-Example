// =============================================================================
// PRISMA SERVICE — Kết nối database PostgreSQL qua Prisma ORM
// =============================================================================
// PrismaService wrap PrismaClient, tích hợp vào NestJS lifecycle:
// - onModuleInit:    tự động kết nối DB khi module khởi tạo
// - onModuleDestroy: tự động đóng kết nối khi module bị hủy (graceful shutdown)
//
// Đánh dấu @Global() để tất cả module trong app đều dùng chung 1 instance,
// không cần import lại ở mỗi module con.

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Logger riêng cho PrismaService — giúp phân biệt log từ DB connection
  private readonly logger = new Logger(PrismaService.name);

  /**
   * NestJS lifecycle hook — được gọi khi module khởi tạo xong.
   * Kết nối tới PostgreSQL database trên Supabase.
   * Nếu kết nối thất bại, NestJS sẽ throw error và app không khởi động.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Đang kết nối tới PostgreSQL (Supabase)...');
    await this.$connect();
    this.logger.log('Kết nối PostgreSQL thành công ✅');
  }

  /**
   * NestJS lifecycle hook — được gọi khi module bị hủy (app shutdown).
   * Đóng connection pool để giải phóng tài nguyên.
   * Quan trọng trong production để tránh connection leak.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Đang đóng kết nối PostgreSQL...');
    await this.$disconnect();
    this.logger.log('Đã đóng kết nối PostgreSQL ✅');
  }
}
