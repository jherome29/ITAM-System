/**
 * Today as YYYY-MM-DD in the user's own timezone — for a date field's
 * min/max. `toISOString()` is UTC, which in Manila (UTC+8) is still yesterday
 * until 08:00, so "max today" would refuse something that happened this morning.
 */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** CICC's clock. Every timestamp on a screen is read in this zone, not the viewer's. */
export const APP_TIME_ZONE = 'Asia/Manila';

const DASH = '—';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

// Newer ICU puts a narrow no-break space before AM/PM; normalise it to a plain space.
const tidy = (s: string) => s.replaceAll('\u202f', ' ');

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A day, for a list column or a sentence ("Oct 16, 2026").
 *
 *  A date-only value (e.g. requiredDate "2026-10-14") is a calendar day: it is formatted
 *  in UTC so the day never shifts with the viewer's zone. A full timestamp is an event: it
 *  shows the day it happened on in CICC's own time. Reading the UTC date out of a timestamp
 *  printed the previous day for anything between midnight and 8 AM Manila time. */
export function formatDate(value: string | null | undefined): string {
  if (value && DATE_ONLY.test(value)) {
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { ...DAY_FORMAT, timeZone: 'UTC' });
  }
  const d = parse(value);
  return d ? d.toLocaleDateString('en-US', { ...DAY_FORMAT, timeZone: APP_TIME_ZONE }) : DASH;
}

/** A moment ("Oct 16, 2026, 12:45 AM") in CICC time. */
export function formatDateTime(value: string | null | undefined): string {
  const d = parse(value);
  if (!d) return DASH;
  return tidy(d.toLocaleString('en-US', { ...DAY_FORMAT, hour: 'numeric', minute: '2-digit', hour12: true, timeZone: APP_TIME_ZONE }));
}

/** Just the time of day ("12:45 AM") in CICC time. */
export function formatTime(value: string | null | undefined): string {
  const d = parse(value);
  if (!d) return DASH;
  return tidy(d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: APP_TIME_ZONE }));
}

/** The short day ("Oct 16") for a compact caption. */
export function formatMonthDay(value: string | null | undefined): string {
  const d = parse(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_TIME_ZONE }) : DASH;
}

/** An amount in pesos ("₱1,234.50"). Decimal columns arrive from the API as strings. */
export function formatPeso(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return DASH;
  const n = Number(value);
  if (!Number.isFinite(n)) return DASH;
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
