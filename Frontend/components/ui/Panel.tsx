import type { ReactNode } from 'react';
import { surfaceClass } from './controls';

/**
 * A titled white card: a table, a list, a group of figures. The title is the section's
 * level-two heading; `detail` is a line of help under it, `badge` a chip beside it and
 * `action` a link or button at the right of the header.
 */
export function Panel({
  title,
  detail,
  badge,
  action,
  children,
  className = '',
}: Readonly<{
  title: string;
  detail?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`min-w-0 overflow-hidden ${surfaceClass} ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-950">{title}</h2>
            {badge}
          </div>
          {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
