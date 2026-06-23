/**
 * Prisma Config — Purchasing Service (Prisma v7)
 *
 * Prisma v7 requires connection config in a separate file (prisma.config.ts)
 * instead of declaring url/directUrl in schema.prisma.
 *
 * This file is used by Prisma CLI only (migrate, generate, studio).
 * Runtime connection is in PrismaService (src/infrastructure/persistence/).
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
  },

  // Prefer DIRECT_URL (port 5432, direct) for migrations.
  // Fallback DATABASE_URL if DIRECT_URL is not set.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
