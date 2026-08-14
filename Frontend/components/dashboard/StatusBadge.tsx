const statusStyles: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Approved: 'bg-blue-50 text-blue-700 ring-blue-200',
  Issued: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Flagged: 'bg-red-50 text-red-700 ring-red-200',
  'Read only': 'bg-slate-100 text-slate-700 ring-slate-200',
  Draft: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[status] ?? statusStyles.Draft}`}>
      {status}
    </span>
  );
}

