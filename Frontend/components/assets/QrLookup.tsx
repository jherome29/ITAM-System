'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Search } from 'lucide-react';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';

export function QrLookup({ detailBasePath }: Readonly<{ detailBasePath: string }>) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Asset | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await assetsApi.list(1, 5, query.trim());
      const items = Array.isArray(res.data)
        ? (res.data as Asset[])
        : ((res.data as unknown as { data: Asset[] }).data ?? []);
      if (items.length === 0) {
        setError('No asset found matching that QR code or property number.');
      } else {
        setResult(items[0]);
      }
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="QR / Barcode Lookup" />

      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 space-y-5">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            <QrCode className="w-8 h-8 text-[#1a4d7a]" />
          </div>
          <p className="text-sm text-gray-500 text-center">
            Scan a QR code using your device camera, or enter a QR code value / property number below.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="QR code value or property number..."
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
        )}

        {result && (
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <div className="bg-blue-50 p-4 border-b border-blue-200">
              <h3 className="font-semibold text-[#1a4d7a]">{result.itemDescription}</h3>
              <p className="text-sm text-gray-500 font-mono mt-0.5">{result.propertyNumber ?? result.id}</p>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <StatusBadge status={result.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Brand</span>
                <span className="text-gray-800">{result.brand ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="text-gray-800">{result.officeOrSection ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Condition</span>
                <span className="text-gray-800 capitalize">{result.condition?.replace(/_/g, ' ') ?? '—'}</span>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <button type="button"
                onClick={() => router.push(`${detailBasePath}/${result.id}`)}
                className="w-full py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors"
              >
                View Full Asset Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
