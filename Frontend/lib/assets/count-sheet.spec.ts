import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { buildCountSheet } from './count-sheet';

const asset = (over: Partial<Asset>): Asset =>
  ({ id: 'a', status: 'available', quantity: 1, officeLocation: '', officeOrSection: '', ...over }) as Asset;

// The "Physical Inventory" pages showed two made-up count rows (INV-001,
// INV-002). The system can't record a physical count, but it can say what it
// EXPECTS to be at each place — the sheet a custodian counts against.
describe('buildCountSheet', () => {
  it('groups assets by location and counts them by status', () => {
    const sheet = buildCountSheet([
      asset({ id: '1', officeLocation: 'Server Room', status: 'available' }),
      asset({ id: '2', officeLocation: 'Server Room', status: 'issued' }),
      asset({ id: '3', officeLocation: 'Server Room', status: 'under_repair' }),
      asset({ id: '4', officeLocation: 'Lab 1', status: 'issued' }),
    ]);
    expect(sheet.rows).toEqual([
      { location: 'Lab 1', items: 1, units: 1, available: 0, issued: 1, underRepair: 0, other: 0 },
      { location: 'Server Room', items: 3, units: 3, available: 1, issued: 1, underRepair: 1, other: 0 },
    ]);
  });

  it('falls back to the office, then "Unspecified", when there is no location', () => {
    const sheet = buildCountSheet([
      asset({ id: '1', officeLocation: '', officeOrSection: 'Digital Forensics' }),
      asset({ id: '2', officeLocation: '  ', officeOrSection: '' }),
    ]);
    expect(sheet.rows.map((r) => r.location)).toEqual(['Digital Forensics', 'Unspecified']);
  });

  it('counts supply lines by units on hand, not as one each', () => {
    const sheet = buildCountSheet([asset({ officeLocation: 'Storeroom', quantity: 40 })]);
    expect(sheet.rows[0]).toMatchObject({ items: 1, units: 40 });
    expect(sheet.totals.units).toBe(40);
  });

  it('puts flagged, returned, registered and transferred assets under "other" and leaves out disposed ones', () => {
    const sheet = buildCountSheet([
      asset({ id: '1', officeLocation: 'X', status: 'flagged_for_disposal' }),
      asset({ id: '2', officeLocation: 'X', status: 'returned' }),
      asset({ id: '3', officeLocation: 'X', status: 'disposed' }),
    ]);
    expect(sheet.rows).toEqual([
      { location: 'X', items: 2, units: 2, available: 0, issued: 0, underRepair: 0, other: 2 },
    ]);
  });

  it('totals every column', () => {
    const sheet = buildCountSheet([
      asset({ id: '1', officeLocation: 'A', status: 'available' }),
      asset({ id: '2', officeLocation: 'B', status: 'issued' }),
    ]);
    expect(sheet.totals).toEqual({ items: 2, units: 2, available: 1, issued: 1, underRepair: 0, other: 0 });
  });
});
