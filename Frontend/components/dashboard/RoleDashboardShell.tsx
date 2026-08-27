'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import type { Requisition } from '@/lib/api/requisitions';

/**
 * Shared shell for the per-role operational dashboards (IT Asset Custodian,
 * Property Custodian, Approving Officer, …). Each of those screens is the same
 * layout — a "Good day" header, a KPI card row, one "awaiting action" list and
 * a notifications footer — over a different set of API calls. The pieces that
 * were byte-for-byte identical between them live here once.
 */

const KPI_TONES = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
} as const;

/**
 * Runs `load` once on mount with the cancel-guard / error / loading bookkeeping
 * every dashboard repeated inline. `load` is intentionally not a dependency —
 * the fetch is one-shot, matching the original `useEffect(..., [])` behaviour.
 */
export function useRoleDashboardData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load dashboard data. Please refresh the page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error };
}

export function RoleDashboardHeader({ eyebrow }: Readonly<{ eyebrow: string }>) {
  const { user } = useAuth();
  return (
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">{eyebrow}</p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950">
        Good day, {user?.firstName ?? 'there'}
      </h1>
    </header>
  );
}

export function DashboardError({ message }: Readonly<{ message: string }>) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
  );
}

export function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  href,
}: Readonly<{
  icon: LucideIcon;
  tone: keyof typeof KPI_TONES;
  label: string;
  value: React.ReactNode;
  href?: string;
}>) {
  const body = (
    <>
      <span className={`grid h-12 w-12 place-items-center rounded-lg border ${KPI_TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-xs font-semibold text-slate-500">{label}</span>
        <span className="text-2xl font-extrabold text-slate-950">{value}</span>
      </span>
    </>
  );
  const base = 'flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm';
  return href ? (
    <Link href={href} className={`${base} transition hover:border-blue-300`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export function RequisitionListSection({
  title,
  items,
  href,
  emptyText,
}: Readonly<{ title: string; items: Requisition[]; href: string; emptyText: string }>) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
        <h2 className="text-[15px] font-extrabold text-slate-950">{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 6).map((req) => (
            <Link
              key={req.id}
              href={href}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50"
            >
              <span className="text-sm font-bold text-slate-950">
                {req.items[0]?.itemDescription ?? 'Requisition'}
              </span>
              <span className="text-xs text-slate-500">{req.requestNumber}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function NotificationsFooter({ count, href }: Readonly<{ count: number; href: string }>) {
  return (
    <p className="text-xs text-slate-500">
      Unread notifications: {count} —{' '}
      <Link href={href} className="font-bold text-blue-700 hover:underline">
        view all
      </Link>
    </p>
  );
}
