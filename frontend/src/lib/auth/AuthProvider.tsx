'use client';
// =============================================================================
// AUTH PROVIDER — Real authentication via auth-service API
// =============================================================================
// Flow:
//   1. On mount: check localStorage for token → validate JWT expiry → restore session
//   2. login(email, password) → POST /auth/login → store JWT + user
//   3. logout() → POST /auth/logout (server-side invalidation) → clear tokens → redirect
//   4. Auth guard: redirect unauthenticated users to /login

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { authAdminApi } from '@/lib/api/authAdmin';
import { AUTH_BYPASS } from './bypass';
import {
  setAuthToken,
  setRefreshToken,
  getAuthToken,
  getRefreshToken,
  clearTokens,
  isTokenExpired,
} from './token';

export type Role = 'admin' | 'manager' | 'staff' | 'viewer';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const USER_STORAGE_KEY = 'erp_user';

// DEV-ONLY login bypass — flag lives in ./bypass so the API client shares it
// (see that module for why). Set NEXT_PUBLIC_AUTH_BYPASS=1 to skip the login
// screen and render the shell as a fake admin when running FE without a backend.
const BYPASS_USER: AuthUser = {
  id: 'dev-bypass',
  name: 'Dev Admin',
  email: 'dev@localhost',
  role: 'admin',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session from localStorage on mount — validate JWT expiry
  useEffect(() => {
    if (AUTH_BYPASS) {
      // Skip the login screen entirely — inject a fake admin.
      setUser(BYPASS_USER);
      setLoading(false);
      return;
    }

    const token = getAuthToken();
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);

    if (token && savedUser) {
      if (isTokenExpired()) {
        // Token expired → clear and force re-login
        // Token refresh will be handled by apiClient interceptor on next API call
        clearTokens();
        localStorage.removeItem(USER_STORAGE_KEY);
      } else {
        try {
          setUser(JSON.parse(savedUser));
          // Best-effort refresh of the in-memory user from /me so role/name
          // reflect the server. Resilient: on ANY error keep the localStorage
          // user and stay logged in — never log out here.
          authAdminApi
            .getMe()
            .then((me) => {
              const fresh: AuthUser = {
                id: me.id,
                name: me.fullName,
                email: me.email,
                role: me.role as Role,
              };
              setUser(fresh);
              localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
            })
            .catch(() => {
              /* ignore — keep the saved user, do not log out */
            });
        } catch {
          clearTokens();
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      }
    }
    setLoading(false);
  }, []);

  // Auth guard: redirect to /login when not authenticated
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [loading, user, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<LoginResponse>('auth', '/api/auth/login', {
      email,
      password,
    });

    const authUser: AuthUser = {
      id: res.user.id,
      name: res.user.fullName,
      email: res.user.email,
      role: res.user.role as Role,
    };

    setAuthToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget: invalidate refresh token on server
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      apiClient
        .post('auth', '/api/auth/logout', { refreshToken })
        .catch(() => {});
    }

    clearTokens();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: user?.role === 'admin',
      loading,
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
