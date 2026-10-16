/**
 * Read every page of a paginated list. Stops when everything the server said it
 * has has been collected, when a page comes back empty, or at `maxPages` — so a
 * server that never reports the end can't loop this forever.
 */
export async function collectAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  pageSize = 500,
  maxPages = 40,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { data, total } = await fetchPage(page, pageSize);
    all.push(...data);
    if (data.length === 0 || all.length >= total) break;
  }
  return all;
}
