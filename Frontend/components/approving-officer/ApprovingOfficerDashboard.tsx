'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClipboardCheck, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { requisitionsApi, type Requisition, type RequisitionStats } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export function ApprovingOfficerDashboard() {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<Requisition[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [stats, setStats] = useState<RequisitionStats | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      requisitionsApi.list(1, 15, 'pending_supervisor'),
      requisitionsApi.stats(),
      notificationsApi.list(),
    ])
      .then(([pendingRes, statsRes, notifRes]) => {
        if (cancelled) return;
        setPendingApprovals(pendingRes.data.data);
        setPendingTotal(pendingRes.data.total);
        setStats(statsRes.data);
        setUnreadCount(notifRes.data.unreadCount);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load dashboard data. Please refresh the page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Approving Officer</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950">Good day, {user?.firstName ?? 'there'}</h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/approving-officer/approvals" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><ClipboardCheck className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Pending my approval</span><span className="text-2xl font-extrabold text-slate-950">{pendingTotal}</span></span>
        </Link>
        <Link href="/approving-officer/requisitions" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><ClipboardList className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">My own requisitions</span><span className="text-2xl font-extrabold text-slate-950">{stats?.total ?? 0}</span></span>
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h2 className="text-[15px] font-extrabold text-slate-950">Awaiting My Approval</h2>
        </div>
        {pendingApprovals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Nothing awaiting your approval right now.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingApprovals.slice(0, 6).map((req) => (
              <Link key={req.id} href="/approving-officer/approvals" className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50">
                <span className="text-sm font-bold text-slate-950">{req.items[0]?.itemDescription ?? 'Requisition'}</span>
                <span className="text-xs text-slate-500">{req.requestNumber}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Unread notifications: {unreadCount} — <Link href="/approving-officer/notifications" className="font-bold text-blue-700 hover:underline">view all</Link>
      </p>
    </div>
  );
}
