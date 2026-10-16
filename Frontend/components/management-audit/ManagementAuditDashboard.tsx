'use client';

import { useEffect, useState } from 'react';
import { Activity, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { reportsApi, type KpiData } from '@/lib/api/reports';
import { requisitionsApi, type RequisitionStats } from '@/lib/api/requisitions';
import { assetsApi, type AssetStats } from '@/lib/api/assets';
import { assetStatusRows, requisitionStatusRows, statusShare, type StatusRow } from '@/lib/reports/status-share';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Notice } from '@/components/ui/Notice';

function StatusBars({ rows, total, empty }: Readonly<{ rows: StatusRow[]; total: number; empty: string }>) {
  if (total === 0) return <p className="p-4 text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-4 p-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold text-slate-700">{row.label}</span>
            <span className="text-slate-500">{row.count} of {total}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-4 rounded-full ${row.tone}`} style={{ width: `${statusShare(row.count, total)}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-semibold text-slate-700">{statusShare(row.count, total)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ManagementAuditDashboard() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [reqStats, setReqStats] = useState<RequisitionStats | null>(null);
  const [assetStats, setAssetStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([reportsApi.kpi(), requisitionsApi.stats(), assetsApi.stats()]).then(([k, r, a]) => {
      if (cancelled) return;
      if (k.status === 'fulfilled') setKpi(k.value.data);
      else setError('Could not load KPI data. Please refresh the page.');
      if (r.status === 'fulfilled') setReqStats(r.value.data);
      if (a.status === 'fulfilled') setAssetStats(a.value.data);
      setLoading(false);
    }).catch(() => {
      // allSettled never rejects, so this only catches a throw inside the
      // handler above — without it the skeleton would stay up forever.
      if (cancelled) return;
      setError('Could not load KPI data. Please refresh the page.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <PageHeader eyebrow="Management" title="Executive Dashboard" detail="Asset and requisition status across the organization. Read-only." />

      {error && (
        <Notice tone="red">{error}</Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><Activity className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Total assets</span><span className="text-2xl font-bold text-slate-950">{kpi?.totalAssets ?? '—'}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"><TrendingUp className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">SLA compliance</span><span className="text-2xl font-bold text-slate-950">{kpi ? `${kpi.slaComplianceRate}%` : '—'}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-purple-200 bg-purple-50 text-purple-700"><BarChart3 className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Record completeness</span><span className="text-2xl font-bold text-slate-950">{kpi ? `${kpi.recordCompleteness}%` : '—'}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><TrendingDown className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Avg approval (hrs)</span><span className="text-2xl font-bold text-slate-950">{kpi?.avgApprovalHours ?? '—'}</span></span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
            <h2 className="text-base font-bold text-slate-950">Requisitions by status</h2>
          </div>
          <StatusBars
            total={reqStats?.total ?? 0}
            empty="No requisitions yet."
            rows={reqStats ? requisitionStatusRows(reqStats) : []}
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
            <h2 className="text-base font-bold text-slate-950">Assets by status</h2>
          </div>
          <StatusBars
            total={assetStats?.total ?? 0}
            empty="No assets yet."
            rows={assetStats ? assetStatusRows(assetStats) : []}
          />
        </section>
      </div>
    </div>
  );
}
