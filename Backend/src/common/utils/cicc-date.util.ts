const CICC_TIME_ZONE = 'Asia/Manila';

// en-CA formats a date as YYYY-MM-DD.
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CICC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date (YYYY-MM-DD) in CICC's time zone - the day a business rule means by "today". */
export function ciccToday(now: Date = new Date()): string {
  return dayFormat.format(now);
}
