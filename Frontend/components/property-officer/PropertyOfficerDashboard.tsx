'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Archive, Boxes, CheckCircle2, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { assetsApi, type AssetStats } from '@/lib/api/assets';
import { requisitionsApi, type Requisition, type RequisitionStats } from '@/lib/api/requisitions';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export function PropertyOfficerDashboard() {
  const { user } = useAuth();
  const [assetStats, setAssetStats] = useState<AssetStats | null>(null);
  const [reqStats, setReqStats] = useState<RequisitionStats | null>(null);
  const [recentRequisitions, setRecentRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      assetsApi.stats(),
      requisitionsApi.stats(),
      requisitionsApi.list(1, 6),
    ])
      .then(([assetRes, reqStatsRes, reqListRes]) => {
        if (cancelled) return;
        setAssetStats(assetRes.data);
        setReqStats(reqStatsRes.data);
        setRecentRequisitions(reqListRes.data.data);
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
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Property Officer</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950">Good day, {user?.firstName ?? 'there'}</h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><Boxes className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Total assets (Fixed + Supplies)</span><span className="text-2xl font-extrabold text-slate-950">{assetStats?.total ?? 0}</span></span>
        </div>
        <Link href="/property-officer/assets" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Available</span><span className="text-2xl font-extrabold text-slate-950">{assetStats?.available ?? 0}</span></span>
        </Link>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><ClipboardList className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Pending requisitions</span><span className="text-2xl font-extrabold text-slate-950">{reqStats?.pending ?? 0}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700"><Archive className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Flagged for disposal</span><span className="text-2xl font-extrabold text-slate-950">{assetStats?.flaggedForDisposal ?? 0}</span></span>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h2 className="text-[15px] font-extrabold text-slate-950">Recent Requisitions</h2>
        </div>
        {recentRequisitions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No requisitions recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentRequisitions.map((req) => (
              <div key={req.id} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm font-bold text-slate-950">{req.items[0]?.itemDescription ?? 'Requisition'}</span>
                <span className="text-xs text-slate-500">{req.requestNumber} · {req.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
