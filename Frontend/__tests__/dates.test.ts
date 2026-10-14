import { describe, expect, it } from 'vitest';
import { localToday } from '@/lib/dates';

describe('localToday', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 07:30 local on 11 Oct — in UTC+8 the ISO string would still say 10 Oct.
    expect(localToday(new Date(2026, 9, 11, 7, 30))).toBe('2026-10-11');
  });

  it('zero-pads month and day', () => {
    expect(localToday(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
