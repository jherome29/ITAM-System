import type { ReactNode } from 'react';

const TEXT = 'px-4 py-10 text-center text-sm text-slate-600';

/** The one row a table shows when it has nothing to list: it spans every column and says why. */
export function EmptyRow({ colSpan, children }: Readonly<{ colSpan: number; children: ReactNode }>) {
  return (
    <tr>
      <td colSpan={colSpan} className={TEXT}>
        {children}
      </td>
    </tr>
  );
}

/** The same message for a list or panel that is not a table. */
export function EmptyMessage({ children }: Readonly<{ children: ReactNode }>) {
  return <p className={TEXT}>{children}</p>;
}
