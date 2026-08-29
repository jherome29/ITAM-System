import { describe, expect, it } from 'vitest';
import { isLowStock } from '@/components/assets/AssetRegistryList';

describe('isLowStock — supply reorder threshold', () => {
  it('flags stock at or below a per-item reorder level', () => {
    expect(isLowStock({ quantity: 3, reorderLevel: 5 })).toBe(true);
    expect(isLowStock({ quantity: 5, reorderLevel: 5 })).toBe(true);
  });

  it('does not flag stock above a per-item reorder level', () => {
    expect(isLowStock({ quantity: 6, reorderLevel: 5 })).toBe(false);
  });

  it('falls back to DEFAULT_REORDER_LEVEL (10) when reorderLevel is null', () => {
    expect(isLowStock({ quantity: 10, reorderLevel: null })).toBe(true);
    expect(isLowStock({ quantity: 11, reorderLevel: null })).toBe(false);
  });
});
