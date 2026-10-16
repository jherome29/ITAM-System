'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClipboardCheck, Repeat2, ShieldCheck } from 'lucide-react';
import { AdminPageHeader, MetricCard, Panel, SearchToolbar, StatusChip, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { REPLACEMENT_BASIS_LABEL, requisitionsApi, type ReplacementReview as Review } from '@/lib/api/requisitions';
import { formatDate, requisitionStatusLabel } from '@/lib/requisitions/requisition-view';

const OPEN = new Set(['pending_supervisor', 'pending_fulfillment', 'on_hold']);

const FILTERS = [
  { value: 'open', label: 'Open requests' },
  { value: 'closed', label: 'Decided' },
  { value: 'All', label: 'All requests' },
];

function statusTone(status: string): 'amber' | 'green' | 'red' | 'slate' {
  if (OPEN.has(status)) return 'amber';
  if (status === 'fulfilled') return 'green';
  if (status === 'rejected') return 'red';
  return 'slate';
}

function RepairCount({ count }: Readonly<{ count: number }>) {
  if (count === 0) return <span className="text-slate-500">—</span>;
  return <span className={count >= 2 ? 'font-semibold text-amber-700' : ''}>{count}</span>;
}

/**
 * Replacement Validation (Property Custodian, read-only). Every replacement
 * requisition with the criterion it was justified on at submission and the
 * replaced unit's repair count, plus the held assets that already qualify —
 * no longer serviceable, aged out, repaired too often, or written off — but
 * have no request yet. The rules themselves are enforced server-side when the
 * holder submits (CLAUDE.md §17); this page is oversight.
 */
export function ReplacementReview({ eyebrow, assetBasePath }: Readonly<{ eyebrow: string; assetBasePath?: string }>) {
  const [data, setData] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');

  useEffect(() => {
    requisitionsApi
      .replacementReview()
      .then((res) => setData(res.data))
      .catch(() => setLoadError('Failed to load replacement requests. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={8} />;

  const requests = data?.requests ?? [];
  const candidates = data?.candidates ?? [];
  const q = search.toLowerCase();
  const visible = requests
    .filter((r) => (filter === 'open' ? OPEN.has(r.status) : filter === 'closed' ? !OPEN.has(r.status) : true))
    .filter((r) => [r.requestNumber, r.replacedAsset?.itemDescription, r.replacedAsset?.propertyNumber, r.requester?.name, r.requester?.employeeId].join(' ').toLowerCase().includes(q));
  const assetLink = (id: string, label: string) =>
    assetBasePath ? <Link href={`${assetBasePath}/${id}`} className="font-bold text-slate-950 hover:text-blue-700 hover:underline">{label}</Link> : <span className="font-bold text-slate-950">{label}</span>;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        eyebrow={eyebrow}
        title="Replacement Validation"
        detail="Replacement requests with the criterion each was justified on, and held items that already qualify for one. The rules — condition, useful life, repeated repairs, loss or damage — are checked by the system when the holder submits."
      />
      {loadError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Open requests" value={String(requests.filter((r) => OPEN.has(r.status)).length)} detail="Awaiting approval or fulfilment" tone="amber" icon={ClipboardCheck} />
        <MetricCard label="Fulfilled" value={String(requests.filter((r) => r.status === 'fulfilled').length)} detail="Old unit collected, receipt generated" tone="green" icon={ShieldCheck} />
        <MetricCard label="Due for replacement" value={String(candidates.length)} detail="Qualify, but no request filed yet" tone="blue" icon={Repeat2} />
      </div>

      <SearchToolbar value={search} onChange={setSearch} filterValue={filter} filterOptions={FILTERS} onFilterChange={setFilter} />
      <Panel title="Replacement requests" detail={`${visible.length} shown · ${requests.length} total`}>
        <TableWrap>
          <table className="w-full min-w-[960px]">
            <thead><tr><th className={thClass}>Request</th><th className={thClass}>Replaces</th><th className={thClass}>Requester</th><th className={thClass}>Justified by</th><th className={thClass}>Repairs (12 mo)</th><th className={thClass}>Submitted</th><th className={thClass}>Status</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className={`${tdClass} font-semibold text-slate-950`}>{r.requestNumber}</td>
                  <td className={tdClass}>{r.replacedAsset ? <>{assetLink(r.replacedAsset.id, r.replacedAsset.itemDescription)}<p className="text-xs text-slate-500">{[r.replacedAsset.propertyNumber, `${r.replacedAsset.assetType} · ${r.replacedAsset.assetClass}`].filter(Boolean).join(' · ')}</p></> : '—'}</td>
                  <td className={tdClass}>{r.requester ? <><p>{r.requester.name}</p><p className="text-xs text-slate-500">{r.requester.employeeId}</p></> : '—'}</td>
                  <td className={tdClass}>{r.replacementBasis ? REPLACEMENT_BASIS_LABEL[r.replacementBasis] : <span className="text-slate-500">Not recorded</span>}</td>
                  <td className={tdClass}><RepairCount count={r.repairsInWindow} /></td>
                  <td className={tdClass}>{formatDate(r.submittedAt ?? r.createdAt)}</td>
                  <td className={tdClass}><StatusChip status={requisitionStatusLabel(r.status)} tone={statusTone(r.status)} /></td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No replacement requests match the current filter.</td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Panel>

      <Panel title="Due for replacement" detail="Held items that meet a replacement criterion but have no open request. The holder can request one from My Assigned Assets.">
        <TableWrap>
          <table className="w-full min-w-[900px]">
            <thead><tr><th className={thClass}>Asset</th><th className={thClass}>Holder</th><th className={thClass}>Criterion</th><th className={thClass}>Repairs (12 mo)</th><th className={thClass}>Acquired</th><th className={thClass}>Why</th></tr></thead>
            <tbody>
              {candidates.map((a) => (
                <tr key={a.id} className="hover:bg-blue-50/40">
                  <td className={tdClass}>{assetLink(a.id, a.itemDescription)}<p className="text-xs text-slate-500">{[a.propertyNumber, `${a.assetType} · ${a.assetClass}`].filter(Boolean).join(' · ')}</p></td>
                  <td className={tdClass}>{a.holder ? <><p>{a.holder.name}</p><p className="text-xs text-slate-500">{a.holder.employeeId}</p></> : '—'}</td>
                  <td className={tdClass}>{a.eligibility.basis ? <StatusChip status={REPLACEMENT_BASIS_LABEL[a.eligibility.basis]} tone={a.eligibility.basis === 'repeat_repair' ? 'amber' : 'blue'} /> : '—'}</td>
                  <td className={tdClass}><RepairCount count={a.repairsInWindow} /></td>
                  <td className={tdClass}>{formatDate(a.acquisitionDate)}</td>
                  <td className={`${tdClass} whitespace-normal text-xs text-slate-600`}>{a.eligibility.reason}</td>
                </tr>
              ))}
              {candidates.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No held item currently qualifies for a replacement.</td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Panel>
    </div>
  );
}
