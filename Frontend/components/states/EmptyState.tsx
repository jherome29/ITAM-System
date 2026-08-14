import { Inbox } from 'lucide-react';

export function EmptyState({ title = 'Nothing to show', detail = 'Records will appear here when available.' }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{detail}</p>
    </div>
  );
}

