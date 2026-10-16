import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './requisition-view';

// CICC works in Manila time (UTC+8), so an event logged at 00:45 local on the
// 16th is stored as 16:45 UTC on the 15th. formatDate() was written for
// date-only values ("2026-10-22") and read the UTC date out of whatever it was
// given, so lists that passed it a timestamp showed the previous day for
// anything between midnight and 8 AM while the drawers (formatDateTime) showed
// the right one.
describe('formatDate', () => {
  it('shows a date-only value as the same calendar day', () => {
    expect(formatDate('2026-10-22')).toBe('Oct 22, 2026');
  });

  it('shows a timestamp as the Manila day it happened on', () => {
    // 00:45 on Oct 16 in Manila
    expect(formatDate('2026-10-15T16:45:10.231Z')).toBe('Oct 16, 2026');
  });

  it('keeps a timestamp late in the Manila day on that day', () => {
    // 23:30 on Oct 15 in Manila
    expect(formatDate('2026-10-15T15:30:00.000Z')).toBe('Oct 15, 2026');
  });

  it('keeps midnight-UTC date columns on their own day', () => {
    expect(formatDate('2026-10-22T00:00:00.000Z')).toBe('Oct 22, 2026');
  });

  it('agrees with formatDateTime about which day it was', () => {
    const iso = '2026-10-15T16:45:10.231Z';
    expect(formatDateTime(iso)).toContain(formatDate(iso));
  });

  it('shows a dash for nothing and for rubbish', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});
