import type { InputHTMLAttributes } from 'react';
import { controlBaseClass } from './controls';

/**
 * Every date box in the system. The calendar pop-up is the browser's own (so it works
 * with the keyboard and a screen reader everywhere); what this fixes is the box around
 * it, which used to be styled four different ways. Takes the usual input props, so a
 * controlled field passes `value`/`onChange` and a form field passes `name`/`required`.
 * It is full width unless the caller sets one (`className="w-44"` in a filter row).
 */
export function DateField({ className = 'w-full', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input {...props} type="date" className={`${controlBaseClass} ${className}`} />;
}

/**
 * A From and a To box for filtering by period. Each limits the other so the range cannot
 * be entered backwards, and reports the chosen day (YYYY-MM-DD) rather than the event.
 */
export function DateRange({
  from,
  to,
  onFromChange,
  onToChange,
}: Readonly<{ from: string; to: string; onFromChange: (day: string) => void; onToChange: (day: string) => void }>) {
  const labelStyle = 'flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-700';
  return (
    <>
      <label className={labelStyle}>
        From
        <DateField className="w-44" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} />
      </label>
      <label className={labelStyle}>
        To
        <DateField className="w-44" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} />
      </label>
    </>
  );
}
