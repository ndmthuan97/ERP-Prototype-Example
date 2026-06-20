/**
 * Prisma Config — Inventory Service (Prisma v7)
 * Connection cho Prisma CLI; ưu tiên DIRECT_URL (5432) cho migrate/db push.
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // migrate/db push nên dùng DIRECT_URL (tránh PgBouncer transaction-pooler)
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
