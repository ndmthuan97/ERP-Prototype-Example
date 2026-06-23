// =============================================================================
// LOGOUT COMMAND — Invalidate refresh token
// =============================================================================
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/persistence/prisma.service.js';

@Injectable()
export class LogoutCommand {
  constructor(private readonly prisma: PrismaService) {}

  async execute(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }
}
