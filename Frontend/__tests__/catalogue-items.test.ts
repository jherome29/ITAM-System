import { describe, expect, it } from 'vitest';
import {
  formatAvailability,
  maxRequestQuantity,
  requisitionItemsLabel,
} from '@/lib/requisitions/catalogue-items';

describe('formatAvailability', () => {
  it('counts units for PPE/SEP items', () => {
    expect(formatAvailability({ available: 3, isSupply: false })).toBe('3 available');
  });

  it('reads as stock on hand for IES supplies', () => {
    expect(formatAvailability({ available: 240, isSupply: true })).toBe('240 on hand');
  });
});

describe('maxRequestQuantity', () => {
  it('caps a picked item at what is available', () => {
    expect(maxRequestQuantity({ available: 3, isSupply: false })).toBe(3);
  });

  it('never exceeds the form ceiling of 99', () => {
    expect(maxRequestQuantity({ available: 240, isSupply: true })).toBe(99);
  });

  it('falls back to the ceiling for a typed-in (not in inventory) item', () => {
    expect(maxRequestQuantity(null)).toBe(99);
  });
});

describe('requisitionItemsLabel', () => {
  it('joins item descriptions', () => {
    expect(
      requisitionItemsLabel([
        { itemDescription: 'Dell Latitude 5420', inInventory: true },
        { itemDescription: 'Mouse', inInventory: true },
      ]),
    ).toBe('Dell Latitude 5420, Mouse');
  });

  it('marks lines that were not in inventory at submission', () => {
    expect(
      requisitionItemsLabel([{ itemDescription: 'Quantum laptop', inInventory: false }]),
    ).toBe('Quantum laptop (not in inventory)');
  });

  it('does not mark older lines that predate the flag', () => {
    expect(requisitionItemsLabel([{ itemDescription: 'Laptop' }])).toBe('Laptop');
  });
});
