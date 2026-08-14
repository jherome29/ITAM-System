'use client';

import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal, Search, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AdminTone } from '@/lib/mock/admin.mock';

const toneStyles: Record<AdminTone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function AdminPageHeader({
  eyebrow = 'Master Administrator',
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{detail}</p>
      </div>
      {action && <div className="flex-none">{action}</div>}
    </header>
  );
}

export function PrimaryButton({
  icon: Icon,
  children,
  onClick,
  type = 'button',
  disabled = false,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ icon: Icon, children, onClick }: { icon?: LucideIcon; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function MetricCard({ label, value, detail, tone, icon: Icon }: { label: string; value: string; detail: string; tone: AdminTone; icon: LucideIcon }) {
  return (
    <article className="rounded-lg border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className={`grid h-9 w-9 flex-none place-items-center rounded-md ring-1 ${toneStyles[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
    </article>
  );
}

export function Panel({ title, detail, action, children, className = '' }: { title: string; detail?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
          {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusChip({ status, tone }: { status: string; tone?: AdminTone }) {
  const inferred: AdminTone = tone ?? (/active|success|healthy|current|published|covered|completed|enabled/i.test(status) ? 'green' : /error|locked|overdue|gap|denied|open/i.test(status) ? 'red' : /warning|review|risk|due|draft|dormant|not enrolled/i.test(status) ? 'amber' : 'slate');
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneStyles[inferred]}`}>{status}</span>;
}

export function SearchToolbar({
  value,
  onChange,
  filterLabel = 'All statuses',
  filterValue = 'All',
  filterOptions = ['All'],
  onFilterChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: string[];
  onFilterChange?: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <span className="sr-only">Search records</span>
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search by name, code, office, or status" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      </label>
      <label className="relative flex h-10 min-w-44 items-center rounded-md border border-slate-200 bg-white pl-9 text-sm font-semibold text-slate-700">
        <SlidersHorizontal className="pointer-events-none absolute left-3 h-4 w-4" />
        <span className="sr-only">{filterLabel}</span>
        <select value={filterValue} onChange={(event) => onFilterChange?.(event.target.value)} className="h-full w-full appearance-none bg-transparent pr-8 outline-none" aria-label={filterLabel}>
          {filterOptions.map((option) => <option key={option} value={option}>{option === 'All' ? filterLabel : option}</option>)}
        </select>
      </label>
      {children}
    </div>
  );
}

export function ActionMenu({ actions }: { actions: Array<{ label: string; onClick: () => void; danger?: boolean }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((value) => !value)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Open row actions" aria-expanded={open}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-44 border border-slate-200 bg-white py-1 shadow-xl">
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={() => { action.onClick(); setOpen(false); }} className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${action.danger ? 'text-red-700' : 'text-slate-700'}`}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-full overflow-x-auto">{children}</div>;
}

export const thClass = 'whitespace-nowrap bg-slate-50 px-4 py-3 text-left text-[11px] font-bold uppercase text-slate-500';
export const tdClass = 'whitespace-nowrap border-t border-slate-100 px-4 py-3 text-sm text-slate-700';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}

export const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
