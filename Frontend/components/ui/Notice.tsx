import type { ReactNode } from 'react';

export type NoticeTone = 'red' | 'amber' | 'blue' | 'green';

const TONE: Record<NoticeTone, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

/**
 * A message in a coloured box: an error under a form, a warning above a table, a "saved".
 * An error is announced to a screen reader the moment it appears (role="alert"); the rest
 * are a polite status. One size and weight for every tone.
 */
export function Notice({
  tone = 'blue',
  icon,
  className = '',
  children,
}: Readonly<{ tone?: NoticeTone; icon?: ReactNode; className?: string; children: ReactNode }>) {
  return (
    <div
      role={tone === 'red' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm font-semibold ${TONE[tone]} ${className}`}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
