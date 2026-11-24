import { describe, expect, it } from 'vitest';
import { rowActionMode } from '@/lib/workflow/row-action';

describe('rowActionMode', () => {
  it('opens the drawer for approvals — Approve/Reject live there', () => {
    expect(rowActionMode('approvals')).toBe('drawer');
  });

  it('opens the drawer for My Requisitions — view-only', () => {
    expect(rowActionMode('requisitions')).toBe('drawer');
  });

  it('opens the drawer for custody — which actions apply depends on the asset', () => {
    expect(rowActionMode('custody')).toBe('drawer');
  });

  it('keeps the direct confirm where the one action is always valid', () => {
    expect(rowActionMode('fulfillment')).toBe('confirm');
    expect(rowActionMode('disposal')).toBe('confirm');
  });
});
