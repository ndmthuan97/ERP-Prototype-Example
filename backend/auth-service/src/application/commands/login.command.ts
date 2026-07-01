// =============================================================================
// LOGIN COMMAND — Authenticate user and issue JWT tokens
// =============================================================================
import { Injectable, Inject } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { v4 } from 'uuid';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.js';
import {
  InvalidCredentialsError,
  InactiveUserError,
} from '../../domain/errors.js';
import { JwtTokenService } from '../../infrastructure/auth/jwt.service.js';
import { PrismaService } from '../../infrastructure/persistence/prisma.service.js';
import { loginSchema } from '../dtos/auth.dto.js';

/**
 * Parse a duration string like '7d', '15m', '1h' to milliseconds.
 */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
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
export class LoginCommand {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly jwtService: JwtTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: unknown): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; fullName: string; role: string };
  }> {
    const dto = loginSchema.parse(input);

    // Find user by email
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    // Check if user is active
    if (!user.isActive) {
      throw new InactiveUserError();
    }

    // Verify password
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    // Sign tokens
    const accessToken = this.jwtService.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    const refreshToken = this.jwtService.signRefreshToken({ sub: user.id });

    // Store refresh token in DB
    const refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    const expiresAt = new Date(Date.now() + parseDurationToMs(refreshTtl));

    await this.prisma.refreshToken.create({
      data: {
        id: v4(),
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
