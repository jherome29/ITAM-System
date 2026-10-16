'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { AdminPageHeader, MetricCard, Panel, StatusChip, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { approvalHistorySummary, decidedRequisitions, turnaroundHours } from '@/lib/requisitions/approval-history';
import { formatDateTime, requesterLabel } from '@/lib/requisitions/requisition-view';
import { Notice } from '@/components/ui/Notice';
import { EmptyMessage } from '@/components/ui/EmptyRow';

function itemsLabel(r: Requisition): string {
  const [first, ...rest] = r.items ?? [];
  if (!first) return '—';
  return rest.length ? `${first.itemDescription} (+${rest.length} more)` : first.itemDescription;
}

/**
 * Approval History (Approving Officer): the requisitions this officer has
 * approved or rejected, newest first, with how long each took and the comment
 * they left. Read-only — the pending queue is the Approval Queue page.
 */
export function ApprovalHistory({ eyebrow }: Readonly<{ eyebrow: string }>) {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    requisitionsApi
      .decided(1, 200)
      .then((res) => setRows(decidedRequisitions(res.data.data)))
      .catch(() => setLoadError('Could not load your approval history. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={8} />;

  const summary = approvalHistorySummary(rows);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow={eyebrow}
        title="Approval History"
        detail="Requisitions you have approved or rejected, newest first, with how long each took you and the comment you left."
      />
      {loadError && <Notice tone="red">{loadError}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Approved" value={String(summary.approved)} detail={`${summary.total} decided in all`} tone="green" icon={CheckCircle2} />
        <MetricCard label="Rejected" value={String(summary.rejected)} detail="Sent back with a reason" tone="red" icon={XCircle} />
        <MetricCard
          label="Average turnaround"
          value={summary.avgTurnaroundHours === null ? '—' : `${summary.avgTurnaroundHours} h`}
          detail={summary.total ? `${summary.withinSla} of ${summary.total} inside the 24-hour SLA` : 'No decisions yet'}
          tone="blue"
          icon={Clock}
        />
      </div>
      <Panel title="Your decisions" detail={`${rows.length} shown`}>
        {rows.length === 0 ? (
          <EmptyMessage>No decisions yet — requisitions you approve or reject will appear here.</EmptyMessage>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[960px]">
              <thead>
                <tr>
                  <th className={thClass}>Request</th>
                  <th className={thClass}>Requester</th>
                  <th className={thClass}>Item</th>
                  <th className={thClass}>Decision</th>
                  <th className={thClass}>Decided</th>
                  <th className={thClass}>Turnaround</th>
                  <th className={thClass}>Your comment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50/40">
                    <td className={`${tdClass} font-bold text-slate-950`}>{r.requestNumber}</td>
                    <td className={tdClass}>{requesterLabel(r.requester)}</td>
                    <td className={tdClass}>{itemsLabel(r)}</td>
                    <td className={tdClass}>
                      <StatusChip status={r.supervisorDecision === 'approved' ? 'Approved' : 'Rejected'} tone={r.supervisorDecision === 'approved' ? 'green' : 'red'} />
                    </td>
                    <td className={tdClass}>{formatDateTime(r.supervisorDecidedAt)}</td>
                    <td className={tdClass}>{turnaroundHours(r) === null ? '—' : `${turnaroundHours(r)} h`}</td>
                    <td className={`${tdClass} max-w-[320px] truncate`} title={r.supervisorComments ?? ''}>{r.supervisorComments?.trim() || '—'}</td>
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
