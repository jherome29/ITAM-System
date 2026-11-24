import { describe, expect, it } from 'vitest';
import { buildCreateAssetPayload, type RegisterAssetFormState } from '@/components/assets/RegisterAssetForm';

const baseForm: RegisterAssetFormState = {
  sapClassification: '',
  itemCode: '',
  itemDescription: 'Bond paper A4',
  brand: '',
  serialNumber: '',
  propertyNumber: '',
  components: '',
  acquisitionCost: '',
  acquisitionDate: '',
  accountableOfficer: '',
  division: '',
  officeOrSection: '',
  officeLocation: '',
  condition: 'serviceable',
  supplier: '',
  dateOfDelivery: '',
  assetClass: 'IES',
  assetType: 'Supplies',
  quantity: '1',
  reorderLevel: '',
};

describe('buildCreateAssetPayload — supply stock fields', () => {
  it('parses quantity and reorderLevel to numbers for IES assets', () => {
    const result = buildCreateAssetPayload({ ...baseForm, assetClass: 'IES', quantity: '5', reorderLevel: '3' });
    expect(result.quantity).toBe(5);
    expect(result.reorderLevel).toBe(3);
  });

  it('defaults quantity to 1 and leaves reorderLevel undefined when both are blank for IES', () => {
    const result = buildCreateAssetPayload({ ...baseForm, assetClass: 'IES', quantity: '', reorderLevel: '' });
    expect(result.quantity).toBe(1);
    expect(result.reorderLevel).toBeUndefined();
    expect(result.propertyNumber).toBeUndefined();
  });

  it('keeps both supply codes and optional identification details', () => {
    const result = buildCreateAssetPayload({
      ...baseForm,
      assetType: 'ICT',
      itemCode: 'SUP-PAPER-A4',
      sapClassification: 'SAP-01',
      brand: 'Supply brand',
      propertyNumber: ' PSC-000123 ',
      serialNumber: 'SN-123',
      components: 'Refills',
    }, 'Supplies');
    expect(result).toMatchObject({
      assetType: 'Supplies', assetClass: 'IES', itemCode: 'SUP-PAPER-A4', sapClassification: 'SAP-01',
      propertyNumber: 'PSC-000123',
      brand: 'Supply brand', serialNumber: 'SN-123', components: 'Refills',
    });
  });

  it('omits quantity and reorderLevel entirely for non-IES assets', () => {
    const result = buildCreateAssetPayload({ ...baseForm, assetClass: 'PPE', assetType: 'ICT', acquisitionCost: '50000', quantity: '1', reorderLevel: '' });
    expect(result).not.toHaveProperty('quantity');
    expect(result).not.toHaveProperty('reorderLevel');
  });

  it('keeps the existing acquisition-field coercion intact', () => {
    const result = buildCreateAssetPayload({
      ...baseForm,
      acquisitionCost: '1250.50',
      acquisitionDate: '2026-02-14',
      dateOfDelivery: '',
    });
    expect(result.acquisitionCost).toBe(1250.5);
    expect(result.acquisitionDate).toBe('2026-02-14');
    expect(result.dateOfDelivery).toBeUndefined();
  });
});


describe('automatic inventory type and classification', () => {
  it('registers IT equipment with its device details and leaves a blank property tag unset', () => {
    const result = buildCreateAssetPayload({
      ...baseForm, acquisitionCost: '50000', propertyNumber: '  ',
      brand: 'Dell', serialNumber: 'SN-10', components: 'Charger',
    }, 'ICT');
    expect(result).toMatchObject({
      assetType: 'ICT', assetClass: 'PPE', brand: 'Dell', serialNumber: 'SN-10', components: 'Charger',
    });
    expect(result.propertyNumber).toBeUndefined();
  });

  it('keeps fixed property identifiers and omits accessories and stock fields', () => {
    const result = buildCreateAssetPayload({
      ...baseForm, acquisitionCost: '45000', propertyNumber: 'FIX-100', serialNumber: 'SN-10',
      brand: 'Manufacturer', components: 'Hidden field',
    }, 'Fixed');
    expect(result).toMatchObject({
      assetType: 'Fixed', assetClass: 'SEP', propertyNumber: 'FIX-100', serialNumber: 'SN-10', brand: 'Manufacturer',
    });
    expect(result).not.toHaveProperty('components');
    expect(result).not.toHaveProperty('quantity');
  });

  it.each([
    ['ICT', '49999.99', 'SEP'],
    ['ICT', '50000', 'PPE'],
    ['Fixed', '50000.01', 'PPE'],
    ['Fixed', '1200', 'SEP'],
    ['Supplies', '100000', 'IES'],
    ['Supplies', '', 'IES'],
  ])('saves %s at unit cost %s as %s', (assetType, acquisitionCost, expectedClass) => {
    const result = buildCreateAssetPayload({ ...baseForm, assetType: 'Supplies', assetClass: 'IES', acquisitionCost }, assetType);
    expect(result.assetType).toBe(assetType);
    expect(result.assetClass).toBe(expectedClass);
  });

  it('uses unit cost rather than multiplying cost by quantity', () => {
    const result = buildCreateAssetPayload({ ...baseForm, acquisitionCost: '25000', quantity: '10' }, 'ICT');
    expect(result.assetClass).toBe('SEP');
    expect(result).not.toHaveProperty('quantity');
  });

  it.each(['', '0', '-1', 'NaN', 'Infinity'])('does not guess a property class for invalid cost %s', acquisitionCost => {
    expect(() => buildCreateAssetPayload({ ...baseForm, acquisitionCost }, 'Fixed')).toThrow('positive acquisition cost');
  });
});
