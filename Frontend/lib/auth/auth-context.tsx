'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { authApi, type AuthUser } from '@/lib/api/auth';
import { setAccessToken, setOnTokenExpired, type ApiResponse } from '@/lib/api/client';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    setAccessToken(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    setOnTokenExpired(clearSession);
  }, [clearSession]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

    // If login() stashed a token to survive the hard-nav reload, use it immediately.
    // Do NOT remove it here — Strict Mode double-invokes effects in dev, and the
    // second run would find an empty key and fall through to the cookie path.
    // Remove it only after the profile call settles.
    const stashed = sessionStorage.getItem('aimrs_at');
    if (stashed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- session restore on mount; must set token synchronously before profile fetch
      setToken(stashed);
      setAccessToken(stashed);
      authApi.profile()
        .then((res) => { setUser(res.data); setIsLoading(false); })
        .catch(() => { setIsLoading(false); })
        .finally(() => sessionStorage.removeItem('aimrs_at'));
      return;
    }

    // Otherwise attempt silent session restore via refresh cookie
    axios
      .post<ApiResponse<{ accessToken: string }>>(
        `${base}/v1/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((r) => {
        const token = r.data.data.accessToken;
        setToken(token);
        setAccessToken(token);
        return authApi.profile();
      })
      .then((res) => { setUser(res.data); setIsLoading(false); })
      .catch(() => { setIsLoading(false); });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await authApi.login({ emailOrEmployeeId: email, password });
    const { accessToken: token, user: u } = res.data;
    setToken(token);
    setAccessToken(token);
    setUser(u);
    // Stash token so the dashboard can restore the session after the hard-nav reload
    sessionStorage.setItem('aimrs_at', token);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
