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

const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
const mockSessionKey = 'aimrs_mock_user';

const mockAccounts: Array<{ email: string; password: string; user: AuthUser }> = [
  {
    email: 'admin@cicc.gov.ph',
    password: 'Admin@CICC2026!',
    user: { id: 'USR-001', email: 'admin@cicc.gov.ph', firstName: 'Ricardo', lastName: 'Torres', role: 'system_admin', division: 'Administration', officeOrSection: 'System Administration' },
  },
  {
    email: 'employee@cicc.gov.ph',
    password: 'Employee@CICC2026!',
    user: { id: 'USR-002', email: 'employee@cicc.gov.ph', firstName: 'Ana', lastName: 'Reyes', role: 'employee', division: 'Digital Forensics', officeOrSection: 'Evidence Processing' },
  },
  {
    email: 'supervisor@cicc.gov.ph',
    password: 'Supervisor@CICC2026!',
    user: { id: 'USR-003', email: 'supervisor@cicc.gov.ph', firstName: 'Mila', lastName: 'Santos', role: 'supervisor', division: 'Operations', officeOrSection: 'Approving Office' },
  },
  {
    email: 'itpersonnel@cicc.gov.ph',
    password: 'CiccIT@2026!Sec',
    user: { id: 'USR-004', email: 'itpersonnel@cicc.gov.ph', firstName: 'Paolo', lastName: 'Cruz', role: 'it_personnel', division: 'Information Technology', officeOrSection: 'ICT Unit' },
  },
  {
    email: 'management@cicc.gov.ph',
    password: 'Management@CICC2026!',
    user: { id: 'USR-005', email: 'management@cicc.gov.ph', firstName: 'Leah', lastName: 'Garcia', role: 'management', division: 'Executive Management', officeOrSection: 'Management and Audit' },
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(mockSessionKey);
    sessionStorage.removeItem('aimrs_at');
    setUser(null);
    setToken(null);
    setAccessToken(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    setOnTokenExpired(clearSession);
  }, [clearSession]);

  useEffect(() => {
    if (useMockData) {
      const savedUser = sessionStorage.getItem(mockSessionKey);
      Promise.resolve().then(() => {
        if (savedUser) {
          try {
            const restoredUser = JSON.parse(savedUser) as AuthUser;
            setUser(restoredUser);
            setToken('mock-session');
            setAccessToken('mock-session');
          } catch {
            sessionStorage.removeItem(mockSessionKey);
          }
        }
        setIsLoading(false);
      });
      return;
    }

    const base = process.env.NEXT_PUBLIC_API_URL ?? '/api';

    // If login() stashed a token to survive the hard-nav reload, use it immediately.
    // Do NOT remove it here — Strict Mode double-invokes effects in dev, and the
    // second run would find an empty key and fall through to the cookie path.
    // Remove it only after the profile call settles.
    const stashed = sessionStorage.getItem('aimrs_at');
    if (stashed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the real API token before requesting the profile
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
    if (useMockData) {
      const account = mockAccounts.find(
        (candidate) => candidate.email === email.trim().toLowerCase() && candidate.password === password,
      );
      if (!account) throw new Error('Invalid credentials');

      setToken('mock-session');
      setAccessToken('mock-session');
      setUser(account.user);
      sessionStorage.setItem(mockSessionKey, JSON.stringify(account.user));
      return account.user;
    }

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
    if (useMockData) {
      clearSession();
      return;
    }

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
