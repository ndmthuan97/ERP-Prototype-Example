// =============================================================================
// AppModule — Root module of Auth Service
// =============================================================================
// Wires up the DI container following SOLID principles.
// Dependency Inversion: USER_REPOSITORY token → PrismaUserRepository
import { Module } from '@nestjs/common';
import {
  MetricsService,
  MetricsController,
  HealthController,
  HEALTH_INDICATORS,
  type HealthIndicator,
} from '@erp/shared';

import { PrismaService } from './infrastructure/persistence/prisma.service.js';
import { PrismaUserRepository } from './infrastructure/persistence/user.repository.impl.js';
import { JwtTokenService } from './infrastructure/auth/jwt.service.js';
import { USER_REPOSITORY } from './domain/repositories/user.repository.js';

import { RegisterCommand } from './application/commands/register.command.js';
import { LoginCommand } from './application/commands/login.command.js';
import { RefreshTokenCommand } from './application/commands/refresh-token.command.js';
import { LogoutCommand } from './application/commands/logout.command.js';
import { GetMeQuery } from './application/queries/get-me.query.js';
import { ListUsersQuery } from './application/queries/list-users.query.js';

import { AuthController } from './presentation/auth.controller.js';

@Module({
  controllers: [
    AuthController,
    HealthController,
    MetricsController,
  ],
  providers: [
    // Infrastructure
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    JwtTokenService,

    // Shared observability
    MetricsService,

    // Health indicators — service declares what to check
    {
      provide: HEALTH_INDICATORS,
      useFactory: (prisma: PrismaService): HealthIndicator[] => [
        {
          name: 'postgres',
          check: async () => {
            await prisma.$queryRaw`SELECT 1`;
            return true;
          },
        },
      ],
      inject: [PrismaService],
    },

    // Application — Use Cases
    RegisterCommand,
    LoginCommand,
    RefreshTokenCommand,
    LogoutCommand,
    GetMeQuery,
    ListUsersQuery,
  ],
})
export class AppModule {}
