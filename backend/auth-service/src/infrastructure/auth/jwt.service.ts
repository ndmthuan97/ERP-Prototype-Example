// =============================================================================
// JWT SERVICE — App access token signing and verification
// =============================================================================
// Under B1 the app access token carries a `sid` (server-side session id). The
// gateway verifies the HS256 signature and looks up `session:<sid>` in Redis;
// refresh tokens are gone (Firebase holds the Google refresh token).
import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';

/** JWT payload structure for app access tokens */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  fullName: string;
  sid: string;
}

@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly accessTtl: string;

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
    this.accessTtl = process.env.APP_TOKEN_TTL || '1h';
  }

  /** Sign an app access token with user claims + session id */
  signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.accessSecret, {
      algorithm: 'HS256',
      expiresIn: this.accessTtl,
    } as jwt.SignOptions);
  }

  /** Verify and decode an app access token */
  verifyAccessToken(token: string): JwtPayload {
    // Pin the algorithm so a token can't be verified with an unexpected alg
    // (defends against algorithm-confusion if an asymmetric key is introduced).
    return jwt.verify(token, this.accessSecret, {
      algorithms: ['HS256'],
    }) as JwtPayload;
  }
}
