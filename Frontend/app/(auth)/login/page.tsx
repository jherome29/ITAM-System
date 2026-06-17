'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/use-auth';

const ROLE_REDIRECTS: Record<string, string> = {
  employee: '/employee/dashboard',
  supervisor: '/supervisor/dashboard',
  it_personnel: '/it-personnel/dashboard',
  system_admin: '/admin/dashboard',
  management: '/management/dashboard',
};

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push(ROLE_REDIRECTS[user.role] ?? '/admin/dashboard');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      window.location.href = ROLE_REDIRECTS[u.role] ?? '/admin/dashboard';
    } catch {
      setError('Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-blue-200 p-8">
      <div className="flex flex-col items-center mb-8">
        <Image src="/logo.png" alt="CICC Logo" width={96} height={96} className="object-contain mb-4" />
        <h1 className="text-2xl font-semibold text-[#1a4d7a]">Asset Management System</h1>
        <p className="text-sm text-gray-500 mt-1">Cybercrime Investigation and Coordinating Center</p>
        <p className="text-sm text-gray-400 mt-1">Sign in to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1a4d7a] text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 mt-2"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
