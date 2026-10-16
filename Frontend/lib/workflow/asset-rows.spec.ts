import { describe, expect, it } from 'vitest';
import { assetApiToRow, dueBack, heldByLabel, humanize, unitAssets } from './asset-rows';
import type { Asset } from '@/lib/api/assets';

const holder = { id: 'u-1', name: 'Juan dela Cruz', employeeId: 'CICC-EMP-001' };
const NOW = new Date('2026-10-15T00:00:00Z').getTime();

describe('heldByLabel', () => {
  it('names the holder with their employee ID', () => {
    expect(heldByLabel({ custodian: holder })).toBe('Juan dela Cruz (CICC-EMP-001)');
  });
  it('says so when nobody holds it', () => {
    expect(heldByLabel({ custodian: null })).toBe('Not issued');
    expect(heldByLabel({})).toBe('Not issued');
  });
});

describe('dueBack', () => {
  it('is nothing for an asset that is not on loan', () => {
    expect(dueBack({ status: 'issued', expectedReturnDate: null }, NOW)).toBeNull();
  });
  it('is nothing once the asset has come back, even if a date was left behind', () => {
    expect(dueBack({ status: 'returned', expectedReturnDate: '2026-10-12' }, NOW)).toBeNull();
  });
  it('shows an upcoming return date', () => {
    expect(dueBack({ status: 'issued', expectedReturnDate: '2026-10-20' }, NOW)).toEqual({
      label: 'Due back Oct 20, 2026',
      date: 'Oct 20, 2026',
      overdue: false,
    });
  });
  it('flags a return date that has passed', () => {
    expect(dueBack({ status: 'issued', expectedReturnDate: '2026-10-12' }, NOW)).toEqual({
      label: 'Due back Oct 12, 2026',
      date: 'Oct 12, 2026',
      overdue: true,
    });
  });
  it('does not call the day itself overdue', () => {
    expect(dueBack({ status: 'issued', expectedReturnDate: '2026-10-15' }, NOW)?.overdue).toBe(false);
  });
});

describe('unitAssets', () => {
  const asset = (assetClass: string) => ({ id: assetClass, assetClass }) as unknown as Asset;

  // A supply line (IES) is stock — 120 reams — not a unit someone can hold. Custody &
  // Issuance is about who holds what, so it lists units only; supplies leave stock
  // through requisition fulfilment.
  it('keeps PPE and SEP units and drops supply lines', () => {
    const kept = unitAssets([asset('PPE'), asset('IES'), asset('SEP')]);
    expect(kept.map((a) => a.assetClass)).toEqual(['PPE', 'SEP']);
  });
});

describe('humanize', () => {
  it('turns enum values into readable text', () => {
    expect(humanize('under_repair')).toBe('Under repair');
    expect(humanize('flagged_for_disposal')).toBe('Flagged for disposal');
    expect(humanize('serviceable')).toBe('Serviceable');
  });
  it('leaves nothing to show as a dash', () => {
    expect(humanize(undefined)).toBe('—');
    expect(humanize('')).toBe('—');
  });
});

describe('assetApiToRow', () => {
  const asset = {
    id: 'a-1',
    itemDescription: 'Dell Latitude 5440 Laptop',
    propertyNumber: 'DEMO-ICT-0003',
    serialNumber: 'SN-1',
    status: 'issued',
    condition: 'serviceable',
    officeOrSection: 'IT Storeroom',
    custodianId: 'u-1',
    custodian: holder,
    expectedReturnDate: null,
  } as unknown as Asset;

  it('carries what the table and drawer show — and no raw holder UUID', () => {
    const row = assetApiToRow(asset);
    expect(row).toMatchObject({
      id: 'a-1',
      item: 'Dell Latitude 5440 Laptop',
      propertyNumber: 'DEMO-ICT-0003',
      status: 'issued',
      heldBy: 'Juan dela Cruz (CICC-EMP-001)',
      location: 'IT Storeroom',
      returnDate: '',
    });
    expect(Object.values(row)).not.toContain('u-1');
  });
});
