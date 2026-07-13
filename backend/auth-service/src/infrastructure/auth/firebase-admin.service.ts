// =============================================================================
// FIREBASE ADMIN SERVICE — Verify Google/Identity Platform ID tokens
// =============================================================================
// Thin wrapper over firebase-admin. The frontend does signInWithPopup(Google)
// and posts the resulting Firebase ID token here; we verify it to learn the
// user's identity (uid/email). We do NOT mint Firebase custom tokens — the app
// access token is our own HS256 JWT (see JwtTokenService).
//
// firebase-admin v14 dropped the legacy `admin.auth()` / `admin.apps` namespace,
// so this uses the modular subpath API. The SDK auto-detects
// FIREBASE_AUTH_EMULATOR_HOST for local/emulator use — no special code needed.
import { Injectable } from '@nestjs/common';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService {
  constructor() {
    // Lazily initialize the default app exactly once (idempotent across DI /
    // hot-reload). Credentials come from Application Default Credentials:
    // GOOGLE_APPLICATION_CREDENTIALS locally, the attached SA on Cloud Run.
    if (getApps().length === 0) {
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }
  }

  /** Verify a Firebase ID token; resolves to the decoded claims (uid, email, ...). */
  verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return getAuth().verifyIdToken(idToken);
  }

  /** Revoke all of a user's Firebase refresh tokens (forces re-auth). */
  revokeRefreshTokens(uid: string): Promise<void> {
    return getAuth().revokeRefreshTokens(uid);
  }
}
