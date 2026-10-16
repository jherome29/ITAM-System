import type { GenerateFormDto } from '@/lib/api/reports';

/**
 * The official COA / CICC forms the system can generate (CLAUDE.md 7.2): what
 * each is, which inputs it needs, and how a filled-in form becomes an API
 * request. Kept free of React so the rules are testable and the generator, the
 * archive and the tests read from one list.
 */

export type FormGroup = 'asset' | 'requisition' | 'period';

export type FormInputKey =
  | 'targetOffice'
  | 'circumstances'
  | 'lossType'
  | 'purpose'
  | 'requestingDivision'
  | 'returnee';

export interface FormDef {
  /** The API's OfficialFormType. */
  type: string;
  /** Short name used on the paper form: "PAR". */
  abbr: string;
  /** Where the form lives in the COA manual: "Appendix 71". */
  code: string;
  name: string;
  description: string;
  group: FormGroup;
  inputs: FormInputKey[];
}

export const FORM_CATALOG: FormDef[] = [
  { type: 'PAR', abbr: 'PAR', code: 'Appendix 71', name: 'Property Acknowledgment Receipt', description: 'Issue property or equipment to an end user.', group: 'asset', inputs: [] },
  { type: 'ICS', abbr: 'ICS', code: 'Appendix 59', name: 'Inventory Custodian Slip', description: 'Issue a semi-expendable item to an end user.', group: 'asset', inputs: [] },
  { type: 'PTR', abbr: 'PTR', code: 'Appendix 76', name: 'Property Transfer Report', description: 'Move an asset from one office or section to another.', group: 'asset', inputs: ['targetOffice'] },
  { type: 'RECEIPT_RETURNED_PROPERTY', abbr: 'RRPE', code: 'Annex 28', name: 'Receipt of Returned Property/Equipment', description: 'Acknowledge property or equipment handed back.', group: 'asset', inputs: ['returnee'] },
  { type: 'RECEIPT_RETURNED_SEP', abbr: 'RRSP', code: 'Annex A.6', name: 'Receipt of Returned Semi-Expendable Property', description: 'Acknowledge a semi-expendable item handed back.', group: 'asset', inputs: ['returnee'] },
  { type: 'IIRUP', abbr: 'IIRUP', code: 'Appendix 74', name: 'Inventory and Inspection Report of Unserviceable Property', description: 'Document an unserviceable asset for disposal.', group: 'asset', inputs: [] },
  { type: 'RLSDDP', abbr: 'RLSDDP', code: 'Appendix 75', name: 'Report of Lost, Stolen, Damaged or Destroyed Property', description: 'Report a loss, theft, damage or destruction.', group: 'asset', inputs: ['lossType', 'circumstances'] },
  { type: 'IAR', abbr: 'IAR', code: 'Appendix 62', name: 'Inspection and Acceptance Report', description: 'Accept a newly delivered asset after inspection.', group: 'asset', inputs: [] },
  { type: 'STICKER_CARD', abbr: 'SC', code: 'Appendix 58', name: 'Sticker Card', description: 'Print the property label for a tagged asset.', group: 'asset', inputs: [] },
  { type: 'MOVE_IN', abbr: 'SS-01', code: 'SS-01', name: 'Move-In Instructions', description: 'Receive assets transferred into a unit.', group: 'asset', inputs: ['requestingDivision'] },
  { type: 'MOVE_OUT', abbr: 'SS-02', code: 'SS-02', name: 'Move-Out Form', description: 'Release assets from a unit to another.', group: 'asset', inputs: ['requestingDivision', 'purpose'] },
  { type: 'RIS', abbr: 'RIS', code: 'RIS', name: 'Requisition and Issue Slip', description: 'The slip for a fulfilled supply requisition.', group: 'requisition', inputs: [] },
  { type: 'RSMI', abbr: 'RSMI', code: 'Appendix 64', name: 'Report of Supplies and Materials Issued', description: 'Supplies issued over a period, with their cost.', group: 'period', inputs: [] },
  { type: 'RSPI', abbr: 'RSPI', code: 'Annex A.7', name: 'Report of Semi-Expendable Property Issued', description: 'Semi-expendable property issued over a period.', group: 'period', inputs: [] },
  { type: 'RPCI', abbr: 'RPCI', code: 'Appendix 66', name: 'Report on Physical Count of Inventories', description: 'Count sheet for supplies and semi-expendable items.', group: 'period', inputs: [] },
  { type: 'RPCPPE', abbr: 'RPCPPE', code: 'Appendix 73', name: 'Report on Physical Count of PPE', description: 'Count sheet for property, plant and equipment.', group: 'period', inputs: [] },
  { type: 'WMR', abbr: 'WMR', code: 'Appendix 65', name: 'Waste Materials Report', description: 'Disposed and unusable materials over a period.', group: 'period', inputs: [] },
  { type: 'ANNEX_A4', abbr: 'A.4', code: 'Annex A.4', name: 'Registry of Semi-Expendable Property Issued', description: 'The running registry of semi-expendable property.', group: 'period', inputs: [] },
];

export const GROUP_META: Record<FormGroup, { label: string; blurb: string }> = {
  asset: { label: 'Asset forms', blurb: 'Generated for one asset: issuing, transferring, returning, reporting.' },
  requisition: { label: 'Requisition forms', blurb: 'Generated for one fulfilled requisition.' },
  period: { label: 'Period reports', blurb: 'Counts and registries over a period. Leave the dates empty for this year to date.' },
};

export const LOSS_TYPES = ['Lost', 'Stolen', 'Damaged', 'Destroyed'] as const;

export function formByType(type: string): FormDef | undefined {
  return FORM_CATALOG.find((f) => f.type === type);
}

/** A stored form's type as people say it; an unknown type is shown as it is. */
export function formTypeLabel(type: string): string {
  return formByType(type)?.name ?? type;
}

export interface FormInputs {
  assetId: string;
  requisitionId: string;
  dateFrom: string;
  dateTo: string;
  targetOffice: string;
  circumstances: string;
  lossType: string;
  purpose: string;
  requestingDivision: string;
  returneeEmployeeId: string;
}

export function emptyFormInputs(): FormInputs {
  return {
    assetId: '',
    requisitionId: '',
    dateFrom: '',
    dateTo: '',
    targetOffice: '',
    circumstances: '',
    lossType: 'Damaged',
    purpose: '',
    requestingDivision: '',
    returneeEmployeeId: '',
  };
}

/** Labels of the required inputs that are still empty; empty when ready to generate. */
export function missingInputs(def: FormDef, values: FormInputs): string[] {
  const missing: string[] = [];
  if (def.group === 'asset' && !values.assetId.trim()) missing.push('Asset');
  if (def.group === 'requisition' && !values.requisitionId.trim()) missing.push('Requisition');
  if (def.inputs.includes('targetOffice') && !values.targetOffice.trim()) missing.push('Receiving office / section');
  if (def.inputs.includes('requestingDivision') && !values.requestingDivision.trim()) missing.push('Requesting division');
  return missing;
}

/** The API request for a filled-in form: only the inputs this form uses, trimmed. */
export function buildFormRequest(def: FormDef, values: FormInputs): GenerateFormDto {
  const request: GenerateFormDto = { formType: def.type };
  const put = (key: 'assetId' | 'requisitionId' | 'targetOffice' | 'circumstances' | 'purpose' | 'requestingDivision' | 'returneeEmployeeId' | 'dateFrom' | 'dateTo') => {
    const value = values[key].trim();
    if (value) request[key] = value;
  };

  if (def.group === 'asset') put('assetId');
  if (def.group === 'requisition') put('requisitionId');
  if (def.group === 'period') {
    put('dateFrom');
    put('dateTo');
  }
  if (def.inputs.includes('targetOffice')) put('targetOffice');
  if (def.inputs.includes('lossType')) request.lossType = values.lossType as GenerateFormDto['lossType'];
  if (def.inputs.includes('circumstances')) put('circumstances');
  if (def.inputs.includes('purpose')) put('purpose');
  if (def.inputs.includes('requestingDivision')) put('requestingDivision');
  if (def.inputs.includes('returnee')) put('returneeEmployeeId');
  return request;
}
