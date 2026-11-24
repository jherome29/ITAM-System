import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { surfaceClass } from './controls';
import { type Tone, toneStyles } from './tones';

/**
 * A figure with its label: a count on a dashboard, a total above a table. Icon on the
 * left in the tone's colour, the figure in the page-title size, an optional line of
 * detail under it. Give it an `href` and the whole card links to the queue behind it.
 */
export function MetricCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
  href,
}: Readonly<{ label: string; value: ReactNode; detail?: string; tone: Tone; icon: LucideIcon; href?: string }>) {
  const body = (
    <>
      <span className={`grid h-12 w-12 flex-none place-items-center rounded-lg ring-1 ${toneStyles[tone]}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-600">{label}</span>
        <span className="block text-2xl font-bold leading-tight text-slate-950">{value}</span>
        {detail && <span className="block text-xs text-slate-500">{detail}</span>}
      </span>
    </>
  );
  const base = `flex min-w-0 items-center gap-4 p-4 ${surfaceClass}`;
  return href ? (
    <Link href={href} className={`${base} transition hover:border-blue-300 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <article className={base}>{body}</article>
  );
}
