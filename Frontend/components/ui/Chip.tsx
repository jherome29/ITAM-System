import type { ReactNode } from 'react';
import { type Tone, toneStyles } from './tones';

/**
 * A small label: a count ("3 pending"), a state ("Not in inventory"), a countdown, a code.
 * Always the same shape and size, coloured from the shared tones. A status badge is a Chip.
 */
export function Chip({
  tone = 'slate',
  icon,
  className = '',
  children,
}: Readonly<{ tone?: Tone; icon?: ReactNode; className?: string; children: ReactNode }>) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneStyles[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
