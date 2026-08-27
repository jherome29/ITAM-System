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
  });

  it('omits quantity and reorderLevel entirely for non-IES assets', () => {
    const result = buildCreateAssetPayload({ ...baseForm, assetClass: 'PPE', quantity: '1', reorderLevel: '' });
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
