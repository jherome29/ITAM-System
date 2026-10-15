import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { locationLabel } from './asset-location';

// A transferred asset's location column still holds where it came from until it
// arrives, so the lists show the move: "Systems Administration → Cyber Intelligence Unit".

const asset = (over: Partial<Asset> = {}): Asset =>
  ({
    status: 'available',
    officeOrSection: 'Systems Administration',
    officeLocation: 'IT Storeroom, 3rd Floor',
    transferredTo: null,
    ...over,
  }) as Asset;

describe('locationLabel', () => {
  it('is the office or section for an asset that has not moved', () => {
    expect(locationLabel(asset())).toBe('Systems Administration');
  });

  it('falls back to the room, then to a dash', () => {
    expect(locationLabel(asset({ officeOrSection: '' }))).toBe('IT Storeroom, 3rd Floor');
    expect(locationLabel(asset({ officeOrSection: '', officeLocation: '' }))).toBe('—');
  });

  it('shows the move for a transferred asset', () => {
    expect(locationLabel(asset({ status: 'transferred', transferredTo: 'Cyber Intelligence Unit' }))).toBe(
      'Systems Administration → Cyber Intelligence Unit',
    );
  });

  it('shows just the destination when the asset had no recorded origin', () => {
    expect(
      locationLabel(asset({ status: 'transferred', officeOrSection: '', officeLocation: '', transferredTo: 'Records Section' })),
    ).toBe('→ Records Section');
  });

  it('shows the plain location once the asset has arrived, whatever it was sent to', () => {
    expect(locationLabel(asset({ status: 'available', officeOrSection: 'Cyber Intelligence Unit', transferredTo: null }))).toBe(
      'Cyber Intelligence Unit',
    );
  });

  it('ignores a destination on an asset that is not transferred', () => {
    expect(locationLabel(asset({ status: 'issued', transferredTo: 'Stale value' }))).toBe('Systems Administration');
  });
});
