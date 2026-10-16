import type { ReactNode } from 'react';

const LINES: Record<number, string> = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' };

/**
 * Text that may be very long (an item description, a justification) in a table cell or card:
 * it keeps to a few lines so one record cannot make a row hundreds of pixels tall, and the
 * whole text is on hover and in the record's drawer.
 */
export function ClampText({ lines = 3, children }: Readonly<{ lines?: 1 | 2 | 3 | 4; children: ReactNode }>) {
  const empty = children === null || children === undefined || children === '';
  const title = typeof children === 'string' ? children : undefined;
  return (
    // No display class here: line-clamp sets display: -webkit-box itself, and block would undo it.
    // max-w-md is a ceiling, not a width: it stops one long description being the widest thing in
    // its table and squeezing every other column.
    <span className={`max-w-md ${LINES[lines]}`} title={title}>
      {empty ? '—' : children}
    </span>
  );
}
