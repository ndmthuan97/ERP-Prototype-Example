// =============================================================================
// TOKEN HOLDER — persist JWT in localStorage, expose getter for apiClient
// =============================================================================
// apiClient reads getAuthToken() to attach Authorization header.
// AuthProvider calls setAuthToken() on login/logout.
// localStorage keeps session alive across page refreshes.

const STORAGE_KEY = 'erp_access_token';
const REFRESH_KEY = 'erp_refresh_token';

let cachedToken: string | null = null;

export function setAuthToken(token: string | null): void {
  cachedToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function getAuthToken(): string | null {
  if (cachedToken) return cachedToken;
  if (typeof window !== 'undefined') {
    cachedToken = localStorage.getItem(STORAGE_KEY);
  }
  return cachedToken;
}

export function setRefreshToken(token: string | null): void {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(REFRESH_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_KEY);
    }
  }
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_KEY);
  }
  return null;
}

export function clearTokens(): void {
  cachedToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

/**
 * Decode JWT payload without verification (client-side only).
 * Returns null if token is malformed.
 */
function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Check if the access token has already expired. */
export function isTokenExpired(): boolean {
  const token = getAuthToken();
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

/** Check if the access token will expire within the given buffer (default 2 min). */
export function isTokenExpiringSoon(bufferMs = 2 * 60 * 1000): boolean {
  const token = getAuthToken();
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000 - bufferMs;
}
