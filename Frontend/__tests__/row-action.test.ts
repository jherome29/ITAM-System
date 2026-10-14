import { describe, expect, it } from 'vitest';
import { rowActionMode } from '@/lib/workflow/row-action';

describe('rowActionMode', () => {
  it('opens the drawer for live approvals — Approve/Reject live there', () => {
    expect(rowActionMode('approvals', true)).toBe('drawer');
  });

  it('opens the drawer for live My Requisitions — view-only', () => {
    expect(rowActionMode('requisitions', true)).toBe('drawer');
  });

  it('keeps the direct confirm for live actions that have a real handler', () => {
    expect(rowActionMode('fulfillment', true)).toBe('confirm');
    expect(rowActionMode('custody', true)).toBe('confirm');
  });

  it('leaves mock pages unchanged', () => {
    expect(rowActionMode('approvals', false)).toBe('confirm');
  });
});
