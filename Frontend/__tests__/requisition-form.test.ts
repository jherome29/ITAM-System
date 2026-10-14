import { describe, expect, it } from 'vitest';
import {
  buildCreateRequisitionDto,
  deriveRequisitionType,
  type RequisitionFormValues,
} from '@/components/requisitions/RequisitionForm';

const base: RequisitionFormValues = {
  requisitionType: 'new',
  justification: 'Need a laptop for fieldwork imaging',
  requiredDate: '2026-09-01',
  itemDescription: 'Laptop',
  quantity: '2',
  assetType: 'ICT',
  assetClass: 'PPE',
  replacedAssetId: '',
};

describe('buildCreateRequisitionDto', () => {
  it('maps the core fields into a single-line-item requisition', () => {
    const dto = buildCreateRequisitionDto(base);
    expect(dto.requisitionType).toBe('new');
    expect(dto.requiredDate).toBe('2026-09-01');
    expect(dto.items).toEqual([
      {
        itemDescription: 'Laptop',
        quantity: 2,
        assetType: 'ICT',
        assetClass: 'PPE',
        justification: 'Need a laptop for fieldwork imaging',
      },
    ]);
  });

  it('includes replacedAssetId when the request type is replacement', () => {
    const dto = buildCreateRequisitionDto({
      ...base,
      requisitionType: 'replacement',
      replacedAssetId: '  3c118686-49d1-47a2-b3af-014aae0de805  ',
    });
    expect(dto.replacedAssetId).toBe('3c118686-49d1-47a2-b3af-014aae0de805');
  });

  it('omits replacedAssetId for a non-replacement type even if a value is present', () => {
    const dto = buildCreateRequisitionDto({
      ...base,
      requisitionType: 'new',
      replacedAssetId: '3c118686-49d1-47a2-b3af-014aae0de805',
    });
    expect(dto).not.toHaveProperty('replacedAssetId');
  });

  it('omits replacedAssetId when replacement is selected but the field is blank', () => {
    const dto = buildCreateRequisitionDto({
      ...base,
      requisitionType: 'replacement',
      replacedAssetId: '   ',
    });
    expect(dto).not.toHaveProperty('replacedAssetId');
  });
});

describe('deriveRequisitionType', () => {
  it('is always replacement when started from an assigned asset', () => {
    expect(deriveRequisitionType(true, { isSupply: false, assetClass: 'PPE' })).toBe('replacement');
    expect(deriveRequisitionType(true, null)).toBe('replacement');
  });

  it('is supply for a consumable (IES) item, picked or described', () => {
    expect(deriveRequisitionType(false, { isSupply: true, assetClass: 'IES' })).toBe('supply');
    expect(deriveRequisitionType(false, { isSupply: false, assetClass: 'IES' })).toBe('supply');
  });

  it('is new for a unit asset, or before anything is picked, and never repair', () => {
    expect(deriveRequisitionType(false, { isSupply: false, assetClass: 'SEP' })).toBe('new');
    expect(deriveRequisitionType(false, null)).toBe('new');
  });
});
