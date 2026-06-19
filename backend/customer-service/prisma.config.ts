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

  // Connection string cho Prisma CLI (migrate, db push, studio)
  // Dùng DATABASE_URL (pooler) — Prisma v7 không còn directUrl
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
