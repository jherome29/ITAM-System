import { Bell, Box, Clock3, PackageCheck, Trash2, Wrench } from 'lucide-react';
import type { KpiMetric } from '@/lib/mock/dashboard.mock';

const toneStyles = {
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
};

const icons = [Box, Clock3, Wrench, Trash2];

export function KpiCard({ metric, index }: Readonly<{ metric: KpiMetric; index: number }>) {
  // Inline if/else (not a helper function call) so react-hooks/static-components
  // can still trace Icon back to a stable module-level identifier.
  let Icon = icons[index % icons.length];
  if (metric.label.includes('Notification')) Icon = Bell;
  else if (metric.label.includes('Assigned')) Icon = PackageCheck;

  return (
    <article className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{metric.label}</p>
        <span className={`rounded-md p-2 ${toneStyles[metric.tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-950">{metric.value}</p>
      <p className="mt-2 text-sm text-slate-500">{metric.detail}</p>
      <p className={`mt-3 text-xs font-semibold ${metric.tone === 'red' || metric.tone === 'amber' ? 'text-red-600' : 'text-emerald-600'}`}>
        {metric.trend}
      </p>
    </article>
  );
}
