'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Boxes, CheckCircle2, ClipboardList, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { assetsApi, type AssetStats } from '@/lib/api/assets';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';

export function ItAssetCustodianDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [pendingFulfillment, setPendingFulfillment] = useState<Requisition[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      assetsApi.stats(),
      requisitionsApi.list(1, 15, 'pending_fulfillment'),
      notificationsApi.list(),
    ])
      .then(([statsRes, reqRes, notifRes]) => {
        if (cancelled) return;
        setStats(statsRes.data);
        setPendingFulfillment(reqRes.data.data);
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
    return <div className="p-8 text-center text-sm text-slate-500">Loading dashboard...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">ICT Asset Custodian</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950">Good day, {user?.firstName ?? 'there'}</h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/it-asset-custodian/assets" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><Boxes className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Total assets</span><span className="text-2xl font-extrabold text-slate-950">{stats?.total ?? 0}</span></span>
        </Link>
        <Link href="/it-asset-custodian/assets" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Available</span><span className="text-2xl font-extrabold text-slate-950">{stats?.available ?? 0}</span></span>
        </Link>
        <Link href="/it-asset-custodian/fulfillment" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><ClipboardList className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Pending fulfillment</span><span className="text-2xl font-extrabold text-slate-950">{pendingFulfillment.length}</span></span>
        </Link>
        <Link href="/it-asset-custodian/maintenance" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700"><Wrench className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Under repair</span><span className="text-2xl font-extrabold text-slate-950">{stats?.underRepair ?? 0}</span></span>
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h2 className="text-[15px] font-extrabold text-slate-950">Awaiting Fulfillment</h2>
        </div>
        {pendingFulfillment.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Nothing awaiting fulfillment right now.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingFulfillment.slice(0, 6).map((req) => (
              <Link key={req.id} href="/it-asset-custodian/fulfillment" className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50">
                <span className="text-sm font-bold text-slate-950">{req.items[0]?.itemDescription ?? 'Requisition'}</span>
                <span className="text-xs text-slate-500">{req.requestNumber}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Unread notifications: {unreadCount} — <Link href="/it-asset-custodian/notifications" className="font-bold text-blue-700 hover:underline">view all</Link>
      </p>
    </div>
  );
}
