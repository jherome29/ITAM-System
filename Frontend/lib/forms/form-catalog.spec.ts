import { describe, expect, it } from 'vitest';
import {
  FORM_CATALOG,
  buildFormRequest,
  emptyFormInputs,
  formByType,
  formTypeLabel,
  missingInputs,
  type FormInputs,
} from './form-catalog';

// Every OfficialFormType the API can generate (packages/shared enums).
const API_FORM_TYPES = [
  'RIS', 'RSMI', 'RSPI', 'RECEIPT_RETURNED_PROPERTY', 'RECEIPT_RETURNED_SEP',
  'ANNEX_A4', 'MOVE_IN', 'MOVE_OUT', 'STICKER_CARD', 'ICS', 'IAR', 'WMR',
  'RPCI', 'PAR', 'RPCPPE', 'IIRUP', 'RLSDDP', 'PTR',
];

const def = (type: string) => {
  const found = formByType(type);
  if (!found) throw new Error(`no ${type} in the catalog`);
  return found;
};
const filled = (over: Partial<FormInputs>): FormInputs => ({ ...emptyFormInputs(), ...over });

describe('form catalog', () => {
  it('offers every form the API can generate, once', () => {
    expect(FORM_CATALOG.map((f) => f.type).sort()).toEqual([...API_FORM_TYPES].sort());
  });

  it('gives every form a code, a name and a description to choose by', () => {
    for (const f of FORM_CATALOG) {
      expect(f.code, f.type).toBeTruthy();
      expect(f.name, f.type).toBeTruthy();
      expect(f.description, f.type).toBeTruthy();
    }
  });

  it('labels a stored form by its name, falling back to the raw type', () => {
    expect(formTypeLabel('PAR')).toBe('Property Acknowledgment Receipt');
    expect(formTypeLabel('NOT_A_FORM')).toBe('NOT_A_FORM');
  });
});

describe('missingInputs', () => {
  it('asks an asset form for the asset', () => {
    expect(missingInputs(def('PAR'), filled({}))).toEqual(['Asset']);
    expect(missingInputs(def('PAR'), filled({ assetId: 'a-1' }))).toEqual([]);
  });

  it('asks the RIS for the requisition', () => {
    expect(missingInputs(def('RIS'), filled({}))).toEqual(['Requisition']);
  });

  it('asks a transfer report for where the asset is going', () => {
    expect(missingInputs(def('PTR'), filled({ assetId: 'a-1' }))).toEqual(['Receiving office / section']);
    expect(missingInputs(def('PTR'), filled({ assetId: 'a-1', targetOffice: '  ' }))).toEqual([
      'Receiving office / section',
    ]);
  });

  it('asks a move form for the requesting division', () => {
    expect(missingInputs(def('MOVE_OUT'), filled({ assetId: 'a-1' }))).toEqual(['Requesting division']);
  });

  it('asks for nothing from a period report', () => {
    expect(missingInputs(def('RPCI'), filled({}))).toEqual([]);
  });

  it('does not require the returnee of a receipt', () => {
    expect(missingInputs(def('RECEIPT_RETURNED_PROPERTY'), filled({ assetId: 'a-1' }))).toEqual([]);
  });
});

describe('buildFormRequest', () => {
  it('sends only what the chosen form uses', () => {
    const request = buildFormRequest(
      def('PAR'),
      filled({ assetId: ' a-1 ', targetOffice: 'Records', requisitionId: 'r-9', dateFrom: '2026-01-01' }),
    );

    expect(request).toEqual({ formType: 'PAR', assetId: 'a-1' });
  });

  it('sends the destination of a transfer', () => {
    expect(buildFormRequest(def('PTR'), filled({ assetId: 'a-1', targetOffice: ' Records ' }))).toEqual({
      formType: 'PTR',
      assetId: 'a-1',
      targetOffice: 'Records',
    });
  });

  it('names the loss type and circumstances of an incident report', () => {
    expect(
      buildFormRequest(
        def('RLSDDP'),
        filled({ assetId: 'a-1', lossType: 'Stolen', circumstances: ' Taken from the car ' }),
      ),
    ).toEqual({ formType: 'RLSDDP', assetId: 'a-1', lossType: 'Stolen', circumstances: 'Taken from the car' });
  });

  it('identifies the returnee by employee ID', () => {
    expect(
      buildFormRequest(def('RECEIPT_RETURNED_SEP'), filled({ assetId: 'a-1', returneeEmployeeId: ' CICC-0042 ' })),
    ).toEqual({ formType: 'RECEIPT_RETURNED_SEP', assetId: 'a-1', returneeEmployeeId: 'CICC-0042' });
  });

  it('leaves the returnee out when nobody was named', () => {
    expect(buildFormRequest(def('RECEIPT_RETURNED_SEP'), filled({ assetId: 'a-1' }))).toEqual({
      formType: 'RECEIPT_RETURNED_SEP',
      assetId: 'a-1',
    });
  });

  it('sends the period of a period report, only when given', () => {
    expect(buildFormRequest(def('RSMI'), filled({ dateFrom: '2026-01-01', dateTo: '2026-06-30' }))).toEqual({
      formType: 'RSMI',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
    });
    expect(buildFormRequest(def('RSMI'), filled({}))).toEqual({ formType: 'RSMI' });
  });

  it('sends the requisition of an RIS', () => {
    expect(buildFormRequest(def('RIS'), filled({ requisitionId: 'r-1' }))).toEqual({
      formType: 'RIS',
      requisitionId: 'r-1',
    });
  });
});
