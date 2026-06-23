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
