/**
 * Prisma Config — Auth Service (Prisma v7)
 *
 * Prisma v7 requires connection config in a separate file (prisma.config.ts)
 * instead of url/directUrl in schema.prisma.
 *
 * This file is only used by Prisma CLI (migrate, generate, studio).
 * Runtime connection is managed in PrismaService (src/infrastructure/persistence/).
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Prisma v7: `prisma db seed` reads the seed command from here
    // (the package.json `"prisma": { "seed" }` key is no longer supported).
    seed: 'ts-node prisma/seed.ts',
  },
  // Prefer DIRECT_URL (port 5432, direct) for migrations.
  // Transaction pooler (DATABASE_URL, 6543/PgBouncer) may cause issues.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
