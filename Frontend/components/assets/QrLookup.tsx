'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Search } from 'lucide-react';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PrimaryButton } from '@/components/admin/AdminUi';
import { buttonClass } from '@/components/ui/buttons';
import { controlClass, surfaceClass } from '@/components/ui/controls';
import { PageHeader } from '@/components/ui/PageHeader';

export function QrLookup({ detailBasePath, eyebrow }: Readonly<{ detailBasePath: string; eyebrow?: string }>) {
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

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader eyebrow={eyebrow} title="QR / Barcode Lookup" detail="Scan a tag or type its number to open the asset record." />

      <div className={`${surfaceClass} space-y-5 p-6`}>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <QrCode className="h-8 w-8 text-brand" />
          </div>
          <p className="text-center text-sm text-slate-600">
            Scan a QR code using your device camera, or enter a QR code value / property number below.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="QR code value or property number..."
            aria-label="QR code value or property number"
            className={`${controlClass} flex-1`}
          />
          <PrimaryButton type="submit" icon={Search} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </PrimaryButton>
        </form>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
        )}

        {result && (
          <div className="overflow-hidden rounded-lg border border-blue-200">
            <div className="border-b border-blue-200 bg-blue-50 p-4">
              <h3 className="text-base font-bold text-brand">{result.itemDescription}</h3>
              <p className="mt-0.5 font-mono text-sm text-slate-600">{result.propertyNumber ?? result.id}</p>
            </div>
            <div className="space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Status</span>
                <StatusBadge status={result.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Brand</span>
                <span className="text-slate-900">{result.brand ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Location</span>
                <span className="text-slate-900">{result.officeOrSection ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Condition</span>
                <span className="capitalize text-slate-900">{result.condition?.replace(/_/g, ' ') ?? '—'}</span>
              </div>
            </div>
            <div className="border-t border-slate-100 p-4">
              <button type="button" onClick={() => router.push(`${detailBasePath}/${result.id}`)} className={`${buttonClass()} w-full`}>
                View Full Asset Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
