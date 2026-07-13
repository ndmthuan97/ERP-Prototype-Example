'use client';
// =============================================================================
// AUTH PROVIDER — Google sign-in (Firebase / GCP Identity Platform) + token exchange
// =============================================================================
// Flow:
//   1. login()  → signInWithPopup(Google) → Firebase ID token
//                → POST /api/auth/sso/callback { idToken } → app access token + user
//   2. logout() → POST /api/auth/logout (Bearer) → signOut(Firebase) → clear + redirect
//   3. On mount: onAuthStateChanged — if a Firebase user exists but the app token is
//      absent/expired, silently re-exchange a fresh ID token for a new app token.
//   4. Auth guard: redirect unauthenticated users to /login.

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
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { apiClient } from '@/lib/api/client';
import { auth, googleProvider } from '@/lib/firebase';
import { AUTH_BYPASS } from './bypass';
import { setAuthToken, clearTokens, isTokenExpired } from './token';

export type Role = 'admin' | 'manager' | 'staff' | 'viewer';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// Response of POST /api/auth/sso/callback — the accessToken is the app token.
interface SsoResponse {
  accessToken: string;
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
  login: () => Promise<void>;
  logout: () => void;
}

const USER_STORAGE_KEY = 'erp_user';

function toAuthUser(u: SsoResponse['user']): AuthUser {
  return { id: u.id, name: u.fullName, email: u.email, role: u.role as Role };
}

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

  // Restore session from the Firebase auth state on mount.
  useEffect(() => {
    if (AUTH_BYPASS) {
      // Skip the login screen entirely — inject a fake admin.
      setUser(BYPASS_USER);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        // No Firebase session → ensure logged-out state.
        clearTokens();
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Reuse a still-valid app token + cached user to avoid a round-trip on
        // every refresh; otherwise silently re-exchange a fresh Firebase ID token.
        const savedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (!isTokenExpired() && savedUser) {
          setUser(JSON.parse(savedUser) as AuthUser);
          return;
        }

        const idToken = await fbUser.getIdToken(true);
        const res = await apiClient.post<SsoResponse>(
          'auth',
          '/api/auth/sso/callback',
          { idToken },
        );
        const authUser = toAuthUser(res.user);
        setAuthToken(res.accessToken);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
        setUser(authUser);
      } catch {
        // Re-exchange failed → force logged-out state.
        clearTokens();
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auth guard: redirect to /login when not authenticated
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [loading, user, pathname, router]);

  const login = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const idToken = await cred.user.getIdToken();
    const res = await apiClient.post<SsoResponse>(
      'auth',
      '/api/auth/sso/callback',
      { idToken },
    );

    const authUser = toAuthUser(res.user);
    setAuthToken(res.accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    // Best-effort server-side logout — gateway derives the session from the Bearer
    // token, so fire it while the token is still stored; never block on failure.
    await apiClient.post('auth', '/api/auth/logout', {}).catch(() => {});
    await signOut(auth).catch(() => {});

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
