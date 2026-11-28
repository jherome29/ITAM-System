import { pageCount, pageRange } from '@/lib/pagination';
import { buttonClass } from './buttons';

/**
 * Previous / Next under a client-side list, with where you are. Shows nothing when the list
 * fits on one page, so a short queue looks the same as before.
 */
export function Pager({
  page,
  total,
  pageSize,
  onPage,
  noun,
}: Readonly<{ page: number; total: number; pageSize: number; onPage: (page: number) => void; noun: string }>) {
  const pages = pageCount(total, pageSize);
  if (total <= pageSize) return null;
  const { from, to } = pageRange(page, total, pageSize);
  return (
    <nav aria-label={`${noun} pages`} className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-sm text-slate-600">
        Showing {from}–{to} of {total} {noun} · Page {page} of {pages}
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          Previous
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          Next
        </button>
      </div>
    </nav>
  );
}
