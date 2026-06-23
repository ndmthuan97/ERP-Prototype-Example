/**
 * PrismaService — Database connection management (Infrastructure Layer)
 *
 * Prisma v7 requires Driver Adapter instead of url in schema.prisma.
 * PrismaPg adapter provides direct PostgreSQL connection.
 *
 * Lifecycle:
 *   - onModuleInit: connect DB when NestJS module initializes
 *   - onModuleDestroy: disconnect when module is destroyed (graceful shutdown)
 */
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Global,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveConnectionString } from '@erp/shared';

@Global()
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma v7: create adapter with connection string from environment.
    // Adapter manages the connection pool instead of Prisma directly.
    const adapter = new PrismaPg({
      connectionString: resolveConnectionString(),
    });
    super({ adapter });
  }

  /** Connect to database when NestJS module initializes */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Disconnect when module is destroyed — prevent connection leaks */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
