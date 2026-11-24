import { describe, expect, it, vi } from 'vitest';
import { collectAllPages } from './collect-pages';

// The asset list is paginated and CICC holds ~2,000 assets. A count sheet built
// from the first page would silently undercount, so it reads every page.
describe('collectAllPages', () => {
  const pager = (all: number[]) =>
    vi.fn(async (page: number, limit: number) => ({ data: all.slice((page - 1) * limit, page * limit), total: all.length }));

  it('concatenates every page, in order', async () => {
    const fetchPage = pager([1, 2, 3, 4, 5]);
    await expect(collectAllPages(fetchPage, 2)).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('makes one request when everything fits on the first page', async () => {
    const fetchPage = pager([1, 2]);
    await expect(collectAllPages(fetchPage, 500)).resolves.toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list for an empty collection', async () => {
    await expect(collectAllPages(pager([]), 500)).resolves.toEqual([]);
  });

  it('stops at the page cap instead of looping forever on a server that never reports the end', async () => {
    const fetchPage = vi.fn(async () => ({ data: [1], total: 1_000_000 }));
    await collectAllPages(fetchPage, 1, 5);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });

  it('stops when a page comes back empty even if the total says there is more', async () => {
    const fetchPage = vi.fn(async (page: number) => ({ data: page === 1 ? [1, 2] : [], total: 99 }));
    await expect(collectAllPages(fetchPage, 2)).resolves.toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
