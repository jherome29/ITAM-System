'use client';

import { useEffect, useState } from 'react';
import { Activity, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { reportsApi, type KpiData } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const MONTHLY_MOCK = [
  { month: 'Mar', req: 48, approved: 41, rejected: 7 },
  { month: 'Apr', req: 55, approved: 47, rejected: 8 },
  { month: 'May', req: 50, approved: 43, rejected: 7 },
  { month: 'Jun', req: 52, approved: 44, rejected: 8 },
];

const UTILIZATION_MOCK = [
  { category: 'Laptops', total: 45, utilized: 30, pct: 67 },
  { category: 'Desktops', total: 30, utilized: 20, pct: 67 },
  { category: 'Monitors', total: 60, utilized: 42, pct: 70 },
  { category: 'Printers', total: 20, utilized: 14, pct: 70 },
];

function PreviewBadge() {
  return <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Preview data</span>;
}

export function ManagementAuditDashboard() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    reportsApi.kpi()
      .then((res) => {
        if (cancelled) return;
        setKpi(res.data);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load KPI data. Please refresh the page.');
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
      <PageHeader title="Executive Dashboard" />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><Activity className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Total assets</span><span className="text-2xl font-extrabold text-slate-950">{kpi?.totalAssets ?? '—'}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"><TrendingUp className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">SLA compliance</span><span className="text-2xl font-extrabold text-slate-950">{kpi ? `${kpi.slaComplianceRate}%` : '—'}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-purple-200 bg-purple-50 text-purple-700"><BarChart3 className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Inventory accuracy</span><span className="text-2xl font-extrabold text-slate-950">{kpi ? `${kpi.inventoryAccuracy}%` : '—'}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><TrendingDown className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Avg approval (hrs)</span><span className="text-2xl font-extrabold text-slate-950">{kpi?.avgApprovalHours ?? '—'}</span></span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-4">
            <h2 className="text-[15px] font-extrabold text-slate-950">Monthly Requisition Trends</h2>
            <PreviewBadge />
          </div>
          <div className="space-y-4 p-4">
            {MONTHLY_MOCK.map((stat) => {
              const approvalRate = ((stat.approved / stat.req) * 100).toFixed(1);
              return (
                <div key={stat.month}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-slate-700">{stat.month}</span><span className="text-slate-500">{stat.req} requisitions</span></div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="flex h-full"><div className="bg-emerald-500" style={{ width: `${(stat.approved / stat.req) * 100}%` }} /><div className="bg-red-400" style={{ width: `${(stat.rejected / stat.req) * 100}%` }} /></div></div>
                    <span className="w-10 text-right text-sm text-slate-600">{approvalRate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-4">
            <h2 className="text-[15px] font-extrabold text-slate-950">Asset Utilization by Category</h2>
            <PreviewBadge />
          </div>
          <div className="space-y-5 p-4">
            {UTILIZATION_MOCK.map((item) => (
              <div key={item.category}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-slate-700">{item.category}</span><span className="text-slate-500">{item.utilized} / {item.total} units</span></div>
                <div className="flex items-center gap-2"><div className="h-4 flex-1 rounded-full bg-slate-200"><div className="h-4 rounded-full bg-blue-700" style={{ width: `${item.pct}%` }} /></div><span className="w-10 text-right text-sm font-semibold text-slate-700">{item.pct}%</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
