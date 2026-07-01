// =============================================================================
// JWT SERVICE — Token signing and verification
// =============================================================================
import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';

/** JWT payload structure for access tokens */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  fullName: string;
}

@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor() {
    // Fail fast: signing/verifying with an empty secret means anyone can forge
    // valid tokens. Refuse to start rather than silently accept forged JWTs.
    const accessSecret = process.env.JWT_SECRET;
    if (!accessSecret) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is required. Auth service cannot start without it.',
      );
    }
    this.accessSecret = accessSecret;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.accessSecret;
    this.accessTtl = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  /** Sign an access token with user claims */
  signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessTtl,
    } as jwt.SignOptions);
  }

  /** Sign a refresh token with minimal claims */
  signRefreshToken(payload: { sub: string }): string {
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshTtl,
    } as jwt.SignOptions);
  }

  /** Verify and decode an access token */
  verifyAccessToken(token: string): JwtPayload {
    // Pin the algorithm so a token can't be verified with an unexpected alg
    // (defends against algorithm-confusion if an asymmetric key is introduced).
    return jwt.verify(token, this.accessSecret, {
      algorithms: ['HS256'],
    }) as JwtPayload;
  }

  /** Verify and decode a refresh token */
  verifyRefreshToken(token: string): { sub: string } {
    return jwt.verify(token, this.refreshSecret, {
      algorithms: ['HS256'],
    }) as { sub: string };
  }
}
