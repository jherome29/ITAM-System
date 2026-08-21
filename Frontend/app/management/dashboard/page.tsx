'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { reportsApi, type KpiData } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const UTILIZATION_MOCK = [
  { category: 'Laptops', total: 45, utilized: 30, pct: 67 },
  { category: 'Desktops', total: 30, utilized: 20, pct: 67 },
  { category: 'Monitors', total: 60, utilized: 42, pct: 70 },
  { category: 'Printers', total: 20, utilized: 14, pct: 70 },
];

const MONTHLY_MOCK = [
  { month: 'Mar', req: 48, approved: 41, rejected: 7 },
  { month: 'Apr', req: 55, approved: 47, rejected: 8 },
  { month: 'May', req: 50, approved: 43, rejected: 7 },
  { month: 'Jun', req: 52, approved: 44, rejected: 8 },
];

export default function ManagementDashboard() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi.kpi()
      .then((res) => setKpi(res.data))
      .catch(() => setError('Failed to load KPI data. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Management Dashboard" />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

      {loading ? (
        <div className="p-4"><LoadingSkeleton rows={4} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-lg"><Activity className="w-6 h-6 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Total Assets</p><p className="text-2xl font-bold text-gray-800">{kpi?.totalAssets ?? '—'}</p></div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="w-6 h-6 text-green-600" /></div>
            <div><p className="text-xs text-gray-500">SLA Compliance</p><p className="text-2xl font-bold text-gray-800">{kpi ? `${kpi.slaComplianceRate}%` : '—'}</p></div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div className="p-2 bg-purple-50 rounded-lg"><BarChart3 className="w-6 h-6 text-purple-600" /></div>
            <div><p className="text-xs text-gray-500">Inventory Accuracy</p><p className="text-2xl font-bold text-gray-800">{kpi ? `${kpi.inventoryAccuracy}%` : '—'}</p></div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div className="p-2 bg-orange-50 rounded-lg"><TrendingDown className="w-6 h-6 text-orange-500" /></div>
            <div><p className="text-xs text-gray-500">Avg Approval (hrs)</p><p className="text-2xl font-bold text-gray-800">{kpi?.avgApprovalHours ?? '—'}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-blue-200">
          <div className="p-5 border-b border-blue-200 bg-blue-50">
            <h2 className="text-base font-semibold text-[#1a4d7a]">Monthly Requisition Trends</h2>
          </div>
          <div className="p-6 space-y-4">
            {MONTHLY_MOCK.map((stat) => {
              const approvalRate = ((stat.approved / stat.req) * 100).toFixed(1);
              return (
                <div key={stat.month}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{stat.month}</span>
                    <span className="text-gray-500">{stat.req} requisitions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
                      <div className="flex h-full">
                        <div className="bg-green-500" style={{ width: `${(stat.approved / stat.req) * 100}%` }} />
                        <div className="bg-red-400" style={{ width: `${(stat.rejected / stat.req) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 w-10 text-right">{approvalRate}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span className="text-green-600">{stat.approved} approved</span>
                    <span className="text-red-500">{stat.rejected} rejected</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-blue-200">
          <div className="p-5 border-b border-blue-200 bg-blue-50">
            <h2 className="text-base font-semibold text-[#1a4d7a]">Asset Utilization by Category</h2>
          </div>
          <div className="p-6 space-y-5">
            {UTILIZATION_MOCK.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{item.category}</span>
                  <span className="text-gray-500">{item.utilized} / {item.total} units</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div className="bg-[#1a4d7a] h-4 rounded-full transition-all" style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-10 text-right">{item.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50">
          <h2 className="text-base font-semibold text-[#1a4d7a]">SLA Performance</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#1a4d7a]">{kpi?.slaComplianceRate ?? '—'}%</p>
            <p className="text-sm text-gray-500 mt-1">Requisitions resolved within 24-hour SLA</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{kpi?.inventoryAccuracy ?? '—'}%</p>
            <p className="text-sm text-gray-500 mt-1">Inventory accuracy vs. physical count</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{kpi?.avgApprovalHours ?? '—'}h</p>
            <p className="text-sm text-gray-500 mt-1">Average requisition approval time</p>
          </div>
        </div>
      </div>
    </div>
  );
}
