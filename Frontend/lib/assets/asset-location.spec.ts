import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { locationLabel } from './asset-location';

// "Location" meant two things: the custody and disposal screens showed the office
// or section, while My Assigned Assets showed the room, for the same asset. It is
// now one label everywhere - office or section, then the room.
//
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
  it('is the office or section and the room for an asset that has not moved', () => {
    expect(locationLabel(asset())).toBe('Systems Administration · IT Storeroom, 3rd Floor');
  });

  it('uses whichever of the two is recorded, then a dash', () => {
    expect(locationLabel(asset({ officeOrSection: '' }))).toBe('IT Storeroom, 3rd Floor');
    expect(locationLabel(asset({ officeLocation: '' }))).toBe('Systems Administration');
    expect(locationLabel(asset({ officeOrSection: '', officeLocation: '' }))).toBe('—');
  });

  it('does not say the same thing twice', () => {
    expect(locationLabel(asset({ officeLocation: ' systems administration ' }))).toBe('Systems Administration');
  });

  it('shows the move for a transferred asset', () => {
    expect(locationLabel(asset({ status: 'transferred', transferredTo: 'Cyber Intelligence Unit' }))).toBe(
      'Systems Administration · IT Storeroom, 3rd Floor → Cyber Intelligence Unit',
    );
  });

  it('shows just the destination when the asset had no recorded origin', () => {
    expect(
      locationLabel(asset({ status: 'transferred', officeOrSection: '', officeLocation: '', transferredTo: 'Records Section' })),
    ).toBe('→ Records Section');
  });

  it('shows the plain location once the asset has arrived, whatever it was sent to', () => {
    expect(
      locationLabel(asset({ status: 'available', officeOrSection: 'Cyber Intelligence Unit', officeLocation: '', transferredTo: null })),
    ).toBe('Cyber Intelligence Unit');
  });

  it('ignores a destination on an asset that is not transferred', () => {
    expect(locationLabel(asset({ status: 'issued', transferredTo: 'Stale value' }))).toBe(
      'Systems Administration · IT Storeroom, 3rd Floor',
    );
  });
});
