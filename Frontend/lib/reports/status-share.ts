/** A count as a whole-number percentage of a total, for a bar's width; 0 for an empty total. */
export function statusShare(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((count / total) * 100));
}

export interface StatusRow {
  label: string;
  count: number;
  tone: string;
}

interface RequisitionCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  fulfilled: number;
  onHold: number;
}

interface AssetCounts {
  total: number;
  available: number;
  issued: number;
  returned: number;
  underRepair: number;
  flaggedForDisposal: number;
  transferred: number;
  disposed: number;
}

/** The part of a total the named rows do not cover, as a row — or nothing when it is all covered. */
function remainder(total: number, rows: StatusRow[], label: string, tone: string): StatusRow[] {
  const left = total - rows.reduce((sum, r) => sum + r.count, 0);
  return left > 0 ? [{ label, count: left, tone }] : [];
}

/**
 * Requisition bars for the Management dashboard. The API's `pending` already
 * includes everything awaiting fulfilment (and `approved` is that part of it), so
 * "awaiting approval" is the difference — taking `pending` as-is counted those
 * requests twice.
 */
export function requisitionStatusRows(stats: RequisitionCounts): StatusRow[] {
  const rows: StatusRow[] = [
    { label: 'Awaiting approval', count: Math.max(0, stats.pending - stats.approved), tone: 'bg-amber-500' },
    { label: 'Approved — awaiting fulfillment', count: stats.approved, tone: 'bg-blue-600' },
    { label: 'On hold', count: stats.onHold, tone: 'bg-slate-500' },
    { label: 'Fulfilled', count: stats.fulfilled, tone: 'bg-emerald-500' },
    { label: 'Rejected', count: stats.rejected, tone: 'bg-red-400' },
  ];
  return [...rows, ...remainder(stats.total, rows, 'Cancelled or draft', 'bg-slate-300')];
}

/** Asset bars: every status, plus assets registered but not yet made available, so they add up to the total. */
export function assetStatusRows(stats: AssetCounts): StatusRow[] {
  const rows: StatusRow[] = [
    { label: 'Available', count: stats.available, tone: 'bg-emerald-500' },
    { label: 'Issued', count: stats.issued, tone: 'bg-blue-700' },
    { label: 'Returned', count: stats.returned, tone: 'bg-sky-500' },
    { label: 'Under repair', count: stats.underRepair, tone: 'bg-amber-500' },
    { label: 'Flagged for disposal', count: stats.flaggedForDisposal, tone: 'bg-red-400' },
    { label: 'Transferred', count: stats.transferred, tone: 'bg-slate-500' },
    { label: 'Disposed', count: stats.disposed, tone: 'bg-slate-400' },
  ];
  return [...rows, ...remainder(stats.total, rows, 'Registered — not yet available', 'bg-slate-300')];
}
