import type { ReactNode } from 'react';

export function ChartCard({ title, subtitle, action, children }: Readonly<{ title: string; subtitle?: string; action?: ReactNode; children: ReactNode }>) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
