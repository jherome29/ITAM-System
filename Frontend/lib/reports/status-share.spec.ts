import { describe, expect, it } from 'vitest';
import { assetStatusRows, requisitionStatusRows, statusShare } from './status-share';

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

// The API's requisition `pending` already includes everything awaiting fulfilment
// (pending_supervisor + pending_fulfillment), and `approved` is the pending_fulfillment
// part of it. Showing `pending` as "Awaiting approval" counted those twice, so the bars
// summed to far more than 100% (7 "awaiting approval" when only 2 were).
describe('requisitionStatusRows', () => {
  const stats = { total: 13, pending: 7, approved: 5, rejected: 2, fulfilled: 3, onHold: 1 };
  const count = (rows: ReturnType<typeof requisitionStatusRows>, label: string) =>
    rows.find((r) => r.label === label)?.count;

  it('counts only requests still waiting on the approving officer as awaiting approval', () => {
    expect(count(requisitionStatusRows(stats), 'Awaiting approval')).toBe(2);
  });

  it('adds up to the total, so the bars read as shares of the whole', () => {
    const rows = requisitionStatusRows(stats);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(13);
  });

  it('shows cancelled / draft requests when there are any, rather than losing them', () => {
    const rows = requisitionStatusRows({ ...stats, total: 15 });
    expect(count(rows, 'Cancelled or draft')).toBe(2);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(15);
  });

  it('has no "other" row when everything is accounted for', () => {
    expect(count(requisitionStatusRows(stats), 'Cancelled or draft')).toBeUndefined();
  });
});

describe('assetStatusRows', () => {
  const stats = { total: 26, available: 13, issued: 9, returned: 1, underRepair: 0, flaggedForDisposal: 3, transferred: 0, disposed: 0 };
  const count = (rows: ReturnType<typeof assetStatusRows>, label: string) =>
    rows.find((r) => r.label === label)?.count;

  it('includes returned assets, which the bars used to leave out', () => {
    expect(count(assetStatusRows(stats), 'Returned')).toBe(1);
  });

  it('shows assets registered but not yet made available as the remainder', () => {
    const rows = assetStatusRows({ ...stats, total: 41 });
    expect(count(rows, 'Registered — not yet available')).toBe(15);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(41);
  });

  it('adds up to the total when nothing is merely registered', () => {
    const rows = assetStatusRows(stats);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(26);
    expect(count(rows, 'Registered — not yet available')).toBeUndefined();
  });
});
