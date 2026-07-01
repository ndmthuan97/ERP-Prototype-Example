// =============================================================================
// REFRESH TOKEN COMMAND — Rotate refresh token and issue new access token
// =============================================================================
import { Injectable } from '@nestjs/common';
import { v4 } from 'uuid';
import {
  InvalidCredentialsError,
  InactiveUserError,
} from '../../domain/errors.js';
import { JwtTokenService } from '../../infrastructure/auth/jwt.service.js';
import { PrismaService } from '../../infrastructure/persistence/prisma.service.js';
import { refreshSchema } from '../dtos/auth.dto.js';

function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

@Injectable()
export class RefreshTokenCommand {
  constructor(
    private readonly jwtService: JwtTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: unknown,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const dto = refreshSchema.parse(input);

    // Verify JWT signature of the refresh token
    let payload: { sub: string };
    try {
      payload = this.jwtService.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new InvalidCredentialsError();
    }

    // Find token record in DB
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new InvalidCredentialsError();
    }

    // Check expiry
    if (tokenRecord.expiresAt < new Date()) {
      // Clean up expired token
      await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw new InvalidCredentialsError();
    }

    // Check if user is still active
    if (!tokenRecord.user.isActive) {
      await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw new InactiveUserError();
    }

    // Delete old token (rotation)
    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });

    // Sign new tokens
    const accessToken = this.jwtService.signAccessToken({
      sub: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
      fullName: tokenRecord.user.fullName,
    });

    const newRefreshToken = this.jwtService.signRefreshToken({
      sub: payload.sub,
    });

    // Store new refresh token
    const refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    const expiresAt = new Date(Date.now() + parseDurationToMs(refreshTtl));

    await this.prisma.refreshToken.create({
      data: {
        id: v4(),
        userId: payload.sub,
        token: newRefreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }
}
