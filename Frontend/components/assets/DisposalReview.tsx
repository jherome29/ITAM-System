'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Archive, UserCheck, UserMinus } from 'lucide-react';
import { AdminPageHeader, MetricCard, Panel, StatusChip, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { disposalReviewSummary } from '@/lib/assets/disposal-review';
import { formatDateTime } from '@/lib/requisitions/requisition-view';
import { Notice } from '@/components/ui/Notice';
import { EmptyMessage } from '@/components/ui/EmptyRow';

/**
 * Disposal Review (Property Custodian, read-only): every asset in the custodian's
 * scope that is flagged for disposal, and whether the person it was issued to
 * is still carrying the accountability (a lost or stolen item stays on their
 * record until COA grants relief). The custodian records the disposal itself;
 * open an asset to read its history and the justification.
 */
export function DisposalReview({ eyebrow, assetBasePath }: Readonly<{ eyebrow: string; assetBasePath: string }>) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    assetsApi
      .list(1, 500, undefined, 'flagged_for_disposal')
      .then((res) => setAssets(res.data.data))
      .catch(() => setLoadError('Could not load the disposal list. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={8} />;

  const summary = disposalReviewSummary(assets);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        eyebrow={eyebrow}
        title="Disposal Review"
        detail="Assets flagged for disposal. A lost or stolen item stays on its holder's accountability record until COA grants relief; open an asset to read its history and the justification."
      />
      {loadError && <Notice tone="red">{loadError}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Flagged for disposal" value={String(summary.total)} detail="Awaiting disposal" tone="amber" icon={Archive} />
        <MetricCard label="Holder still accountable" value={String(summary.stillAccountable)} detail="Lost or stolen — until COA relief" tone="red" icon={UserCheck} />
        <MetricCard label="Released" value={String(summary.released)} detail="No one holds them" tone="slate" icon={UserMinus} />
      </div>
      <Panel title="Flagged assets" detail={`${assets.length} in your scope`}>
        {assets.length === 0 ? (
          <EmptyMessage>Nothing is flagged for disposal.</EmptyMessage>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className={thClass}>Asset</th>
                  <th className={thClass}>Property no.</th>
                  <th className={thClass}>Class</th>
                  <th className={thClass}>Condition</th>
                  <th className={thClass}>Office / location</th>
                  <th className={thClass}>Accountability</th>
                  <th className={thClass}>Last updated</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="hover:bg-blue-50/40">
                    <td className={tdClass}>
                      <Link href={`${assetBasePath}/${a.id}`} className="font-bold text-slate-950 hover:text-blue-700 hover:underline">{a.itemDescription}</Link>
                    </td>
                    <td className={tdClass}>{a.propertyNumber || '—'}</td>
                    <td className={tdClass}>{a.assetClass} · {a.assetType}</td>
                    <td className={tdClass}>{a.condition.replaceAll('_', ' ')}</td>
                    <td className={tdClass}>{a.officeLocation || a.officeOrSection || '—'}</td>
                    <td className={tdClass}>
                      {a.custodianId ? <StatusChip status="Holder still accountable" tone="amber" /> : <StatusChip status="Released" tone="slate" />}
                    </td>
                    <td className={tdClass}>{formatDateTime(a.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
