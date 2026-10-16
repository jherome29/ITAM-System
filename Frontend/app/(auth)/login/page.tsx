'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { buttonClass } from '@/components/ui/buttons';
import { controlClass, controlWithTrailingIconClass, labelClass } from '@/components/ui/controls';

const ROLE_REDIRECTS: Record<string, string> = {
  employee: '/employee/dashboard',
  supervisor: '/approving-officer/dashboard',
  it_personnel: '/it-asset-custodian/dashboard',
  system_admin: '/master-admin/dashboard',
  management: '/management-audit/dashboard',
  property_custodian: '/property-custodian/dashboard',
};

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // OWASP ASVS V2.1.12 — user may temporarily reveal the masked password.
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push(ROLE_REDIRECTS[user.role] ?? '/employee/dashboard');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    // Re-mask on submit so the plaintext is not left on screen.
    setShowPassword(false);
    setLoading(true);
    try {
      const u = await login(email, password);
      window.location.href = ROLE_REDIRECTS[u.role] ?? '/employee/dashboard';
    } catch {
      setError('Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-blue-200 p-8">
      <div className="flex flex-col items-center mb-8">
        <Image src="/logo.png" alt="CICC Logo" width={96} height={96} className="object-contain mb-4" />
        <h1 className="text-2xl font-bold text-brand">Asset Management System</h1>
        <p className="text-sm text-slate-500 mt-1">Cybercrime Investigation and Coordinating Center</p>
        <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelClass}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={controlClass}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // The trailing-icon control leaves room for the toggle; ::-ms-reveal hides Edge's built-in eye so there aren't two.
              className={`${controlWithTrailingIconClass} [&::-ms-reveal]:hidden`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              aria-controls="password"
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-brand focus:outline-none focus-visible:text-brand focus-visible:ring-2 focus-visible:ring-brand/30 rounded-r-md transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`${buttonClass()} mt-2 w-full`}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
