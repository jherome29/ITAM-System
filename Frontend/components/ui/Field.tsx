import type { ReactNode } from 'react';
import { labelClass } from './controls';

/** A label over a control, with an optional hint, or an error written out in words. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: Readonly<{ label: string; hint?: string; error?: string; required?: boolean; children: ReactNode }>) {
  return (
    // The label wraps its control, so the two are associated without ids.
    <label className="block">
      <span className={labelClass}>
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs font-semibold text-red-700">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}
