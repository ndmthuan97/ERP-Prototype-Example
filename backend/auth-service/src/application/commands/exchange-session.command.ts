// =============================================================================
// EXCHANGE SESSION COMMAND — Firebase ID token → app access token (SSO callback)
// =============================================================================
// Replaces the old email/password LoginCommand under B1. The frontend obtains a
// Firebase ID token via signInWithPopup(Google) and posts it here; we verify it,
// gate by the allowlist (must already exist in `users`), open a server-side
// session, and issue our own HS256 app access token carrying the session id.
import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.js';
import {
  InvalidCredentialsError,
  InactiveUserError,
  NotProvisionedError,
} from '../../domain/errors.js';
import { JwtTokenService } from '../../infrastructure/auth/jwt.service.js';
import { FirebaseAdminService } from '../../infrastructure/auth/firebase-admin.service.js';
import { SessionService } from '../../infrastructure/auth/session.service.js';
import { ssoCallbackSchema } from '../dtos/auth.dto.js';

@Injectable()
export class ExchangeSessionCommand {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtTokenService,
  ) {}

  async execute(
    input: unknown,
    ctx?: { ip?: string; userAgent?: string },
  ): Promise<{
    accessToken: string;
    user: { id: string; email: string; fullName: string; role: string };
  }> {
    const dto = ssoCallbackSchema.parse(input);

    // 1. Verify the Firebase ID token. Any failure (bad signature, expired,
    //    wrong audience) is a credential failure — do not leak SDK internals.
    let decoded;
    try {
      decoded = await this.firebaseAdmin.verifyIdToken(dto.idToken);
    } catch {
      throw new InvalidCredentialsError();
    }

    // 2. Require a verified email — an unverified email must not sign in.
    if (!decoded.email || decoded.email_verified !== true) {
      throw new InvalidCredentialsError();
    }

    // 3. Allowlist gate: the email must already exist in `users`.
    const user = await this.userRepo.findByEmail(decoded.email);
    if (!user) {
      throw new NotProvisionedError(decoded.email);
    }
    if (!user.isActive) {
      throw new InactiveUserError();
    }

    // 4. Link the Google account to this user on first sign-in; afterwards pin
    //    it — a different uid for the same email means the email was re-used by
    //    a different Google account (reject rather than silently re-link).
    if (!user.firebaseUid) {
      user.firebaseUid = decoded.uid;
      await this.userRepo.save(user);
    } else if (user.firebaseUid !== decoded.uid) {
      throw new InvalidCredentialsError();
    }

    // 5. Open a server-side session (whitelist entry + durable row).
    const { sid } = await this.sessionService.create({
      userId: user.id,
      role: user.role,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    // 6. Issue the app access token carrying the session id.
    const accessToken = this.jwtService.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      sid,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
