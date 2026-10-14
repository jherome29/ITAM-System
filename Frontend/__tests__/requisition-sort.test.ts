import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUISITION_SORT, compareRequisitionRows } from '@/lib/workflow/requisition-sort';

const older = { item: 'B', status: 'pending_supervisor', submittedDate: '2026-10-01T08:00:00Z', requiredDate: '2026-10-20' };
const newer = { item: 'A', status: 'on_hold', submittedDate: '2026-10-08T08:00:00Z', requiredDate: '2026-10-10' };
const sortBy = (option: string) => [older, newer].sort((a, b) => compareRequisitionRows(option, a, b));

describe('compareRequisitionRows', () => {
  it('defaults to newest submission first', () => {
    expect(DEFAULT_REQUISITION_SORT).toBe('Newest first');
    expect(sortBy(DEFAULT_REQUISITION_SORT)).toEqual([newer, older]);
  });

  it('sorts oldest first and by soonest required date', () => {
    expect(sortBy('Oldest first')).toEqual([older, newer]);
    expect(sortBy('Required by (soonest)')).toEqual([newer, older]);
  });

  it('sorts by status and item text', () => {
    expect(sortBy('Status')).toEqual([newer, older]);
    expect(sortBy('Item')).toEqual([newer, older]);
  });

  it('puts rows with no submitted date last under the default', () => {
    const undated = { item: 'C' };
    expect([undated, older].sort((a, b) => compareRequisitionRows(DEFAULT_REQUISITION_SORT, a, b))).toEqual([older, undated]);
  });
});
