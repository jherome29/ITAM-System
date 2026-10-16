'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Boxes, ClipboardList, MapPin } from 'lucide-react';
import { AdminPageHeader, MetricCard, Panel, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { collectAllPages } from '@/lib/api/collect-pages';
import { buildCountSheet } from '@/lib/assets/count-sheet';
import { buttonClass } from '@/components/ui/buttons';

/**
 * Physical Inventory: what the system expects to find at each location, from
 * the live asset records in the caller's scope — the sheet a custodian counts
 * against. The official count report (RPCI / RPCPPE) is generated from Reports
 * & Forms. Recording the counted quantities back into the system is not built
 * yet, and this page says so.
 */
export function PhysicalInventorySheet({ eyebrow, formsPath }: Readonly<{ eyebrow: string; formsPath: string }>) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    collectAllPages<Asset>((page, limit) => assetsApi.list(page, limit).then((res) => ({ data: res.data.data, total: res.data.total })))
      .then(setAssets)
      .catch(() => setLoadError('Failed to load the asset records. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={8} />;

  const { rows, totals } = buildCountSheet(assets);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        eyebrow={eyebrow}
        title="Physical Inventory"
        detail="What the system expects to find at each location. Count against this sheet, then generate the official count report from Reports & Forms."
        action={<Link href={formsPath} className={buttonClass()}>Open Reports &amp; Forms</Link>}
      />
      {loadError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        This is the system&apos;s expected count. Recording the quantities you actually counted is not available in this version yet.
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Locations" value={String(rows.length)} detail="With at least one asset" tone="blue" icon={MapPin} />
        <MetricCard label="Asset records" value={String(totals.items)} detail="Excluding disposed" tone="slate" icon={ClipboardList} />
        <MetricCard label="Units on hand" value={String(totals.units)} detail="Supply lines count by quantity" tone="green" icon={Boxes} />
      </div>
      <Panel title="Expected count by location" detail={`${rows.length} locations`}>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No assets to count yet.</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className={thClass}>Location</th>
                  <th className={`${thClass} text-right`}>Records</th>
                  <th className={`${thClass} text-right`}>Units</th>
                  <th className={`${thClass} text-right`}>Available</th>
                  <th className={`${thClass} text-right`}>Issued</th>
                  <th className={`${thClass} text-right`}>Under repair</th>
                  <th className={`${thClass} text-right`}>Other</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.location} className="hover:bg-blue-50/40">
                    <td className={`${tdClass} font-bold text-slate-950`}>{r.location}</td>
                    <td className={`${tdClass} text-right`}>{r.items}</td>
                    <td className={`${tdClass} text-right`}>{r.units}</td>
                    <td className={`${tdClass} text-right`}>{r.available}</td>
                    <td className={`${tdClass} text-right`}>{r.issued}</td>
                    <td className={`${tdClass} text-right`}>{r.underRepair}</td>
                    <td className={`${tdClass} text-right`}>{r.other}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className={tdClass}>Total</td>
                  <td className={`${tdClass} text-right`}>{totals.items}</td>
                  <td className={`${tdClass} text-right`}>{totals.units}</td>
                  <td className={`${tdClass} text-right`}>{totals.available}</td>
                  <td className={`${tdClass} text-right`}>{totals.issued}</td>
                  <td className={`${tdClass} text-right`}>{totals.underRepair}</td>
                  <td className={`${tdClass} text-right`}>{totals.other}</td>
                </tr>
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
