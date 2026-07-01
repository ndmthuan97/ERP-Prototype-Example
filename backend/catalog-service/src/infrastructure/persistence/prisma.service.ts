// =============================================================================
// PRISMA SERVICE — Database connection management (Infrastructure Layer)
// =============================================================================

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Global,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveConnectionString } from "@erp/shared";

@Global()
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: resolveConnectionString(),
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
