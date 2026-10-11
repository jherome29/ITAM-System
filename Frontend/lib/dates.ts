/**
 * Today as YYYY-MM-DD in the user's own timezone — for `<input type="date">`
 * min/max. `toISOString()` is UTC, which in Manila (UTC+8) is still yesterday
 * until 08:00, so "max today" would refuse something that happened this morning.
 */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
