// =============================================================================
// END SESSION COMMAND — Logout: revoke the current server-side session
// =============================================================================
// Replaces the old refresh-token LogoutCommand under B1. The gateway injects the
// caller's session id (x-user-sid); revoking it drops the Redis whitelist entry
// and the durable row so the app token is instantly dead (FR-A13).
import { Injectable } from '@nestjs/common';
import { SessionService } from '../../infrastructure/auth/session.service.js';

@Injectable()
export class EndSessionCommand {
  constructor(private readonly sessionService: SessionService) {}

  async execute(sid: string): Promise<void> {
    // No session id (e.g. token already gone) — nothing to revoke.
    if (!sid) return;
    await this.sessionService.revoke(sid);
  }
}
