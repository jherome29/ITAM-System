import { ciccToday } from './cicc-date.util';

// CICC works in Manila time (UTC+8). "Today" for a business rule is the Manila
// calendar day, not the server's or the browser's.
describe('ciccToday', () => {
  it('is the Manila day, which is already tomorrow late in the UTC day', () => {
    expect(ciccToday(new Date('2026-10-15T16:45:00Z'))).toBe('2026-10-16');
  });

  it('is still the same day just before Manila midnight', () => {
    expect(ciccToday(new Date('2026-10-15T15:59:00Z'))).toBe('2026-10-15');
  });

  it('is a plain YYYY-MM-DD', () => {
    expect(ciccToday(new Date('2026-01-05T00:00:00Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
