import type { ReactNode } from 'react';

/**
 * The top of every page: workspace eyebrow, the page title (with an optional status badge
 * beside it), a line of help, and the page's main action. The only level-one heading a
 * page has; lib/ui-consistency.spec.ts holds that. A dashboard passes its "Good day, …"
 * greeting as the title and `divider` for the rule underneath.
 */
export function PageHeader({
  eyebrow,
  title,
  badge,
  detail,
  action,
  divider = false,
}: Readonly<{
  eyebrow?: string;
  title: string;
  badge?: ReactNode;
  detail?: string;
  action?: ReactNode;
  divider?: boolean;
}>) {
  const heading = <h1 className={`${eyebrow ? 'mt-1 ' : ''}text-2xl font-bold text-slate-950`}>{title}</h1>;
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${divider ? 'border-b border-slate-200 pb-5' : ''}`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{eyebrow}</p>}
        {badge ? (
          <div className="flex flex-wrap items-center gap-3">
            {heading}
            {badge}
          </div>
        ) : (
          heading
        )}
        {detail && <p className="mt-1 max-w-3xl text-sm text-slate-600">{detail}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </header>
  );
}
