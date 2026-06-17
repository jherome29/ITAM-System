'use client';

import { useEffect, useState } from 'react';
import { Package, Search } from 'lucide-react';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function CataloguePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Asset[]>([]);

  useEffect(() => {
    assetsApi.catalogue()
      .then((res) => { setAssets(res.data.data); setFiltered(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.toLowerCase();
    setFiltered(q ? assets.filter((a) => a.itemDescription.toLowerCase().includes(q) || a.brand.toLowerCase().includes(q) || a.assetType.toLowerCase().includes(q)) : assets);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Asset Catalogue" />

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#1a4d7a]" />
            <h2 className="text-base font-semibold text-[#1a4d7a]">Available Assets</h2>
            <span className="text-xs text-gray-500">({filtered.length} items)</span>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, brand, type..."
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] w-60"
              />
            </div>
            <button type="submit" className="bg-[#1a4d7a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors">Search</button>
          </form>
        </div>

        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={8} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Description', 'Brand', 'Type', 'Class', 'Division / Section', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No assets found.</td></tr>
                ) : (
                  filtered.map((asset) => (
                    <tr key={asset.id} className="hover:bg-blue-50 transition-colors text-sm">
                      <td className="px-6 py-4 font-medium text-gray-800">{asset.itemDescription}</td>
                      <td className="px-6 py-4 text-gray-600">{asset.brand || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{asset.assetType}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">{asset.assetClass}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{asset.officeOrSection || '—'}</td>
                      <td className="px-6 py-4"><StatusBadge status={asset.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
