// =============================================================================
// FIREBASE CLIENT — Google sign-in via GCP Identity Platform
// =============================================================================
// One Firebase app instance for the browser. Guards against re-init (fast-refresh
// / multiple imports) and reuses the existing app under SSR. Config values come
// from NEXT_PUBLIC_* env, inlined at build time.

import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';

const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Optional: point the client at a local Auth emulator for offline dev.
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
}
