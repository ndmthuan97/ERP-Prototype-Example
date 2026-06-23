'use client';
// =============================================================================
// AUTH PROVIDER — Real authentication via auth-service API
// =============================================================================
// Flow:
//   1. On mount: check localStorage for existing token → restore session
//   2. login(email, password) → POST /auth/login → store JWT + user
//   3. logout() → clear tokens + redirect to /login
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
import { setAuthToken, setRefreshToken, getAuthToken, clearTokens } from './token';

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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = getAuthToken();
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        clearTokens();
        localStorage.removeItem(USER_STORAGE_KEY);
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

    // Persist tokens and user
    setAuthToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
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
