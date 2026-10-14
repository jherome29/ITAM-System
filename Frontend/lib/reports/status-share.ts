/** A count as a whole-number percentage of a total, for a bar's width; 0 for an empty total. */
export function statusShare(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((count / total) * 100));
}
