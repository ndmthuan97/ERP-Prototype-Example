/**
 * Prisma Config — Customer Service (Prisma v7)
 *
 * Prisma v7 yêu cầu tách connection config ra file riêng (prisma.config.ts)
 * thay vì khai báo url/directUrl trong schema.prisma như trước.
 *
 * File này chỉ dùng cho Prisma CLI (migrate, generate, studio).
 * Runtime connection nằm trong PrismaService (src/infrastructure/persistence/).
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Đường dẫn tới schema file
  schema: 'prisma/schema.prisma',

  // Thư mục chứa migration files
  migrations: {
    path: 'prisma/migrations',
  },

  // Connection string cho Prisma CLI (migrate, db push, studio).
  // ƯU TIÊN DIRECT_URL (port 5432, direct): migrate/db push qua transaction-pooler
  // (DATABASE_URL, 6543/PgBouncer) dễ lỗi "prepared statement already exists" / treo.
  // Fallback DATABASE_URL nếu chưa set DIRECT_URL.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
