// =============================================================================
// DEV-ONLY auth bypass flag (single source of truth)
// =============================================================================
// Kept in its own module so BOTH the AuthProvider (injects a fake admin) and the
// API client (must NOT hard-redirect to /login on 401 while bypassing) read the
// EXACT same condition — without importing React code into the plain HTTP layer.
//
// Why the client must know: bypass sets a fake user but NO JWT, so every real API
// call 401s. If the 401 handler still did `window.location.href='/login'`, the
// login page would re-inject the bypass user and bounce back to home → an
// infinite home⇄login loop. When bypass is on we swallow the 401 instead.
//
// Hard-gated to non-production: NEXT_PUBLIC_* is inlined at build time and
// `next build` forces NODE_ENV=production, so a real build can never enable it.
export const AUTH_BYPASS =
  process.env.NEXT_PUBLIC_AUTH_BYPASS === '1' &&
  process.env.NODE_ENV !== 'production';
