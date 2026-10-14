import { describe, expect, it } from 'vitest';
import { statusShare } from './status-share';

// The Management dashboard's two charts were hard-coded sample numbers
// ("Mar: 48 requisitions", "Laptops 30 / 45 units"). They now read the real
// status counts; this turns a count into the bar's width.
describe('statusShare', () => {
  it('is the count as a whole-number percentage of the total', () => {
    expect(statusShare(1, 3)).toBe(33);
    expect(statusShare(2, 3)).toBe(67);
    expect(statusShare(5, 5)).toBe(100);
  });

  it('is 0 when there is nothing to divide by (an empty system), not NaN', () => {
    expect(statusShare(0, 0)).toBe(0);
    expect(statusShare(3, 0)).toBe(0);
  });

  it('never exceeds 100', () => {
    expect(statusShare(7, 5)).toBe(100);
  });
});
