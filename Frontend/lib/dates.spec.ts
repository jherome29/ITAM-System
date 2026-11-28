import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMonthDay, formatPeso, formatTime } from './dates';
import * as requisitionView from './requisitions/requisition-view';

// Every date on every screen goes through these helpers. Calling toLocaleString()
// with no locale printed 10/16/2026 on one machine and 16/10/2026 on another, and a
// timestamp read in the viewer's own zone could land on a different day than the
// audit trail. CICC's clock is Asia/Manila (UTC+8); a calendar day never shifts.

// 2026-10-16 00:45 in Manila is still the 15th in UTC.
const JUST_AFTER_MIDNIGHT_MANILA = '2026-10-15T16:45:10.231Z';

describe('formatDate', () => {
  it('writes a calendar day as it was entered, whatever the viewer\'s zone', () => {
    expect(formatDate('2026-10-22')).toBe('Oct 22, 2026');
  });

  it('writes a timestamp as the day it happened in Manila', () => {
    expect(formatDate(JUST_AFTER_MIDNIGHT_MANILA)).toBe('Oct 16, 2026');
  });

  it('shows a dash for nothing or for rubbish', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('writes the Manila day and a 12-hour time', () => {
    expect(formatDateTime(JUST_AFTER_MIDNIGHT_MANILA)).toBe('Oct 16, 2026, 12:45 AM');
  });

  it('uses a plain space before AM/PM, not the narrow no-break space newer ICU emits', () => {
    expect(formatDateTime(JUST_AFTER_MIDNIGHT_MANILA)).not.toContain(' ');
  });

  it('shows a dash for nothing or for rubbish', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('nope')).toBe('—');
  });
});

describe('formatTime', () => {
  it('writes only the Manila time', () => {
    expect(formatTime(JUST_AFTER_MIDNIGHT_MANILA)).toBe('12:45 AM');
  });

  it('shows a dash for nothing or for rubbish', () => {
    expect(formatTime(undefined)).toBe('—');
    expect(formatTime('nope')).toBe('—');
  });
});

describe('formatMonthDay', () => {
  it('writes the short Manila day for a compact caption', () => {
    expect(formatMonthDay(JUST_AFTER_MIDNIGHT_MANILA)).toBe('Oct 16');
  });
});

describe('formatPeso', () => {
  it('writes pesos with a thousands separator and two decimals', () => {
    expect(formatPeso(1234.5)).toBe('₱1,234.50');
    expect(formatPeso(50000)).toBe('₱50,000.00');
  });

  it('accepts the numeric strings the API returns for decimal columns', () => {
    expect(formatPeso('50000.00')).toBe('₱50,000.00');
  });

  it('shows a dash for nothing or for rubbish', () => {
    expect(formatPeso(null)).toBe('—');
    expect(formatPeso(undefined)).toBe('—');
    expect(formatPeso('')).toBe('—');
    expect(formatPeso('abc')).toBe('—');
  });

  it('keeps a real zero', () => {
    expect(formatPeso(0)).toBe('₱0.00');
  });
});

describe('the requisition helpers', () => {
  it('are the same functions, not a second copy that can drift', () => {
    expect(requisitionView.formatDate).toBe(formatDate);
    expect(requisitionView.formatDateTime).toBe(formatDateTime);
  });
});
