// Client-side paging for lists the API returns whole. Rendering a few hundred rows at
// once (each with its buttons and badges) blocked the browser for one to two seconds, so a
// list shows one page at a time. Pure functions so vitest (node env) can cover them.

export const DEFAULT_PAGE_SIZE = 25;

/** Pages in a list; never fewer than one, so an empty list still has a page to show. */
export function pageCount(total: number, size: number = DEFAULT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** A page number kept inside the list, so a filter that shrinks it cannot strand the user past the end. */
export function clampPage(page: number, total: number, size: number = DEFAULT_PAGE_SIZE): number {
  const whole = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(1, whole), pageCount(total, size));
}

/** One page of a list (1-based), without changing the list. */
export function pageSlice<T>(items: readonly T[], page: number, size: number = DEFAULT_PAGE_SIZE): T[] {
  const current = clampPage(page, items.length, size);
  return items.slice((current - 1) * size, current * size);
}

/** Which records a page shows, counting from 1: "Showing 26 to 50". 0 to 0 for an empty list. */
export function pageRange(page: number, total: number, size: number = DEFAULT_PAGE_SIZE): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const current = clampPage(page, total, size);
  return { from: (current - 1) * size + 1, to: Math.min(current * size, total) };
}

/** What a list remembers about its place: the page, and the filters it was on when it got there. */
export interface PageState {
  page: number;
  key: string;
}

/** The page to show: the remembered one while the filters are unchanged, otherwise the first. */
export function currentPage(state: PageState, key: string): number {
  return state.key === key ? state.page : 1;
}
