// Two vocabularies land here: mock/prototype rows use capitalized English labels
// ('Pending', 'Approved', ...), while pages wired to the real API pass the raw
// lowercase snake_case RequisitionStatus/AssetStatus enum values directly
// (e.g. 'pending_supervisor', 'flagged_for_disposal'). Both need a style and a
// readable label — real values are never pre-formatted before reaching this component.
const statusStyles: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Approved: 'bg-blue-50 text-blue-700 ring-blue-200',
  Issued: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Flagged: 'bg-red-50 text-red-700 ring-red-200',
  'Read only': 'bg-slate-100 text-slate-700 ring-slate-200',
  Draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  // RequisitionStatus (real, lowercase)
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending_supervisor: 'bg-amber-50 text-amber-700 ring-amber-200',
  pending_fulfillment: 'bg-blue-50 text-blue-700 ring-blue-200',
  on_hold: 'bg-orange-50 text-orange-700 ring-orange-200',
  fulfilled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  cancelled: 'bg-slate-100 text-slate-700 ring-slate-200',
  // AssetStatus (real, lowercase)
  registered: 'bg-slate-100 text-slate-700 ring-slate-200',
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  issued: 'bg-blue-50 text-blue-700 ring-blue-200',
  returned: 'bg-slate-100 text-slate-700 ring-slate-200',
  transferred: 'bg-blue-50 text-blue-700 ring-blue-200',
  under_repair: 'bg-amber-50 text-amber-700 ring-amber-200',
  flagged_for_disposal: 'bg-red-50 text-red-700 ring-red-200',
  disposed: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function statusLabel(status: string): string {
  if (!status.includes('_')) return status;
  return status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[status] ?? statusStyles.Draft}`}>
      {statusLabel(status)}
    </span>
  );
}

