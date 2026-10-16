'use client';

import { useState } from 'react';
import { DEFAULT_PAGE_SIZE, clampPage, currentPage, pageCount, pageRange, pageSlice, type PageState } from './pagination';

/**
 * One page of a client-side list. Pass the filters (a search, a status) as `resetKey` and the
 * list starts again at page 1 whenever they change; the page is also kept inside the list if
 * it shrinks. No effect needed: the page is derived from what the list last remembered.
 */
export function usePaged<T>(items: readonly T[], resetKey = '', size: number = DEFAULT_PAGE_SIZE) {
  const [state, setState] = useState<PageState>({ page: 1, key: resetKey });
  const page = clampPage(currentPage(state, resetKey), items.length, size);
  return {
    page,
    setPage: (next: number) => setState({ page: next, key: resetKey }),
    pageItems: pageSlice(items, page, size),
    total: items.length,
    pages: pageCount(items.length, size),
    size,
    ...pageRange(page, items.length, size),
  };
}
