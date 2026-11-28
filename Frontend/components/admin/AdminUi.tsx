'use client';

import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonClass, type ButtonSize, type ButtonVariant } from '@/components/ui/buttons';
import type { Tone } from '@/components/ui/tones';
import { Chip } from '@/components/ui/Chip';

// Semantic colour role for admin cards, chips, and status rows; the palette itself is
// shared (components/ui/tones.ts) so the whole system colours "good" the same way.
export type AdminTone = Exclude<Tone, 'orange'>;

export function AdminPageHeader({
  eyebrow = 'Master Administrator',
  title,
  detail,
  action,
}: Readonly<{
  eyebrow?: string;
  title: string;
  detail: string;
  action?: ReactNode;
}>) {
  return <PageHeader eyebrow={eyebrow} title={title} detail={detail} action={action} />;
}

interface ButtonProps {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: ButtonSize;
}

function renderButton(variant: ButtonVariant, { icon: Icon, children, onClick, type = 'button', disabled = false, size = 'md' }: ButtonProps) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={buttonClass({ variant, size })}>
      {Icon && <Icon className="h-5 w-5" />}
      {children}
    </button>
  );
}

export function PrimaryButton(props: Readonly<ButtonProps>) {
  return renderButton('primary', props);
}

export function SecondaryButton(props: Readonly<ButtonProps>) {
  return renderButton('secondary', props);
}

export function DangerButton(props: Readonly<ButtonProps>) {
  return renderButton('danger', props);
}

// Word-boundary anchored so a keyword must appear as its own word (e.g. the
// literal word "active"), not merely as a substring of a longer word — this
// is what previously made "Inactive" match "active" via .includes()-style
// substring testing and get misclassified as a positive/green status.
function inferToneFromStatus(status: string): AdminTone {
  if (/\b(active|success|healthy|current|published|covered|completed|enabled)\b/i.test(status)) return 'green';
  if (/\b(error|locked|overdue|gap|denied|open)\b/i.test(status)) return 'red';
  if (/\b(warning|review|risk|due|draft|dormant|not enrolled)\b/i.test(status)) return 'amber';
  return 'slate';
}

export function StatusChip({ status, tone }: Readonly<{ status: string; tone?: AdminTone }>) {
  const inferred: AdminTone = tone ?? inferToneFromStatus(status);
  return <Chip tone={inferred}>{status}</Chip>;
}

export function ActionMenu({ actions }: Readonly<{ actions: Array<{ label: string; onClick: () => void; danger?: boolean }> }>) {
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
      <button type="button" onClick={() => setOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Open row actions" aria-expanded={open}>
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
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

export function TableWrap({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="w-full max-w-full overflow-x-auto">{children}</div>;
}

// Table cells and headers may wrap. A no-wrap default pushed 16 tables wider than their
// panel once the text got bigger, hiding the Actions column off the right edge.
export const thClass = 'break-normal bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase text-slate-500';
export const tdClass = 'border-t border-slate-100 px-4 py-3 text-sm text-slate-700';
/** For a column that must stay on one line: a time, a count. */
export const tdNoWrapClass = `whitespace-nowrap ${tdClass}`;

// The form kit lives in components/ui; these names stay importable from here so the
// admin screens (and everything built on them) keep one import path.
export { Field } from '@/components/ui/Field';
export { MetricCard } from '@/components/ui/MetricCard';
export { Panel } from '@/components/ui/Panel';
export { controlClass as inputClass } from '@/components/ui/controls';
export { SearchToolbar, type FilterOption, type ToolbarFilter } from '@/components/ui/SearchToolbar';
