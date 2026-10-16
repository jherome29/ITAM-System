'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import type { Requisition } from '@/lib/api/requisitions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Notice } from '@/components/ui/Notice';

/**
 * Shared shell for the per-role operational dashboards (IT Asset Custodian,
 * Property Custodian, Approving Officer, …). Each of those screens is the same
 * layout — a "Good day" header, a KPI card row, one "awaiting action" list and
 * a notifications footer — over a different set of API calls. The pieces that
 * were byte-for-byte identical between them live here once.
 */

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
        if (!cancelled) setError('Could not load dashboard data. Please refresh the page.');
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
    <PageHeader eyebrow={eyebrow} title={`Good day, ${user?.firstName ?? 'there'}`} divider />
  );
}

export function DashboardError({ message }: Readonly<{ message: string }>) {
  if (!message) return null;
  return (
    <Notice tone="red">{message}</Notice>
  );
}

export function RequisitionListSection({
  title,
  items,
  href,
  emptyText,
}: Readonly<{ title: string; items: Requisition[]; href: string; emptyText: string }>) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-600">{emptyText}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 6).map((req) => (
            <Link
              key={req.id}
              href={href}
              className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50"
            >
              <span className="text-sm font-bold text-slate-950">
                {req.items[0]?.itemDescription ?? 'Requisition'}
              </span>
              <span className="text-xs text-slate-500">{req.requestNumber}</span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function NotificationsFooter({ count, href }: Readonly<{ count: number; href: string }>) {
  return (
    <p className="text-sm text-slate-600">
      Unread notifications: {count} —{' '}
      <Link href={href} className="font-bold text-blue-700 hover:underline">
        view all
      </Link>
    </p>
  );
}
