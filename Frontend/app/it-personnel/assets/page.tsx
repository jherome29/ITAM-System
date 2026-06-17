'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Package } from 'lucide-react';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

const STATUS_OPTIONS = [
  'REGISTERED', 'AVAILABLE', 'ISSUED', 'RETURNED',
  'TRANSFERRED', 'UNDER_REPAIR', 'FLAGGED_FOR_DISPOSAL', 'DISPOSED',
];

export default function AssetsInventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const limit = 15;

  useEffect(() => {
    assetsApi
      .list(page, limit, search || undefined, filterStatus || undefined)
      .then((res) => {
        setAssets(res.data.data ?? []);
        setTotalPages(res.data.totalPages ?? 1);
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [page, search, filterStatus]);

  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors bg-white';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Inventory"
        action={
          <Link
            href="/it-personnel/assets/new"
            className="bg-[#1a4d7a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors duration-150"
          >
            + Register New Asset
          </Link>
        }
      />

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by description, property #, serial #..."
            value={search}
            onChange={(e) => { setLoading(true); setSearch(e.target.value); setPage(1); }}
            className={`${inputClass} pl-9 w-full`}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setLoading(true); setFilterStatus(e.target.value); setPage(1); }}
          className={inputClass}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <Package className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Asset Registry</h2>
        </div>
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={8} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Property #', 'Description', 'Brand', 'Class', 'Type', 'Condition', 'Location', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assets.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-400">No assets found.</td></tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-blue-50 transition-colors duration-100">
                      <td className="px-5 py-3 text-sm font-mono text-gray-600 whitespace-nowrap">{asset.propertyNumber ?? '—'}</td>
                      <td className="px-5 py-3 text-sm text-gray-800 max-w-[200px] truncate">{asset.itemDescription}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{asset.brand ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{asset.assetClass}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{asset.assetType}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 capitalize">{asset.condition?.replace(/_/g, ' ') ?? '—'}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">{asset.officeOrSection ?? asset.officeLocation ?? '—'}</td>
                      <td className="px-5 py-3"><StatusBadge status={asset.status} /></td>
                      <td className="px-5 py-3">
                        <Link href={`/it-personnel/assets/${asset.id}`} className="text-[#1a4d7a] text-sm font-medium hover:underline">View</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-gray-100">
            <button
              onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)); }}
              disabled={page === 1}
              className="px-4 py-1.5 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => { setLoading(true); setPage((p) => Math.min(totalPages, p + 1)); }}
              disabled={page === totalPages}
              className="px-4 py-1.5 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
