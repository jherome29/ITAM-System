import { describe, expect, it } from 'vitest';
import { assetOption, requisitionMatches, requisitionOption } from './picker-options';

const asset = {
  id: 'a-1',
  itemDescription: 'Dell Latitude 5440',
  propertyNumber: 'P-2025-001',
  serialNumber: 'SN-1',
  status: 'issued',
  officeOrSection: 'Network Operations',
};
const requisition = {
  id: 'r-1',
  requestNumber: 'REQ-0031',
  fulfilledAt: '2026-10-03T08:00:00Z',
  requester: { id: 'u-1', name: 'Juan dela Cruz', employeeId: 'CICC-0042', officeOrSection: 'Field' },
  items: [{ itemDescription: 'Bond Paper A4' }, { itemDescription: 'Ink Cartridge' }],
};

describe('assetOption', () => {
  it('shows what a custodian recognises an asset by', () => {
    expect(assetOption(asset)).toEqual({
      id: 'a-1',
      title: 'Dell Latitude 5440',
      subtitle: 'P-2025-001 · SN-1 · Issued · Network Operations',
    });
  });

  it('says so when the asset has no property number', () => {
    expect(assetOption({ ...asset, propertyNumber: '', serialNumber: '' }).subtitle).toBe(
      'No property no. · Issued · Network Operations',
    );
  });

  it('reads the status as words', () => {
    expect(assetOption({ ...asset, status: 'flagged_for_disposal' }).subtitle).toContain('Flagged for disposal');
  });
});

describe('requisitionOption', () => {
  it('names the request, who asked and what for', () => {
    expect(requisitionOption(requisition)).toEqual({
      id: 'r-1',
      title: 'REQ-0031 · Juan dela Cruz',
      subtitle: 'Bond Paper A4, Ink Cartridge',
    });
  });

  it('copes with a requisition whose requester is not loaded', () => {
    expect(requisitionOption({ ...requisition, requester: null }).title).toBe('REQ-0031');
  });
});

describe('requisitionMatches', () => {
  it('finds a requisition by number, requester or item', () => {
    expect(requisitionMatches(requisition, 'req-0031')).toBe(true);
    expect(requisitionMatches(requisition, 'dela cruz')).toBe(true);
    expect(requisitionMatches(requisition, 'cicc-0042')).toBe(true);
    expect(requisitionMatches(requisition, 'ink')).toBe(true);
    expect(requisitionMatches(requisition, 'laptop')).toBe(false);
  });

  it('matches everything when nothing is typed', () => {
    expect(requisitionMatches(requisition, '')).toBe(true);
  });
});
