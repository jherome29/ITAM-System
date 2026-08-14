import type { ActivityRow } from '@/lib/mock/dashboard.mock';
import { StatusBadge } from './StatusBadge';

export function ActivityTable({ rows, emptyMessage = 'No activity to display.' }: { rows: ActivityRow[]; emptyMessage?: string }) {
  if (rows.length === 0) {
    return <p className="bg-slate-50 p-5 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden border-t border-slate-100">
      <table className="w-full text-left">
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row) => (
            <tr key={row.id} className="transition hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                <p className="text-xs text-slate-500">{row.id} • {row.owner}</p>
              </td>
              <td className="hidden px-4 py-3 text-sm text-slate-500 sm:table-cell">{row.date}</td>
              <td className="px-4 py-3 text-right"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
