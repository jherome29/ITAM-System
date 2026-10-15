import type { PickerOption } from '@/components/forms/RecordPicker';

/** The slice of an asset the picker needs; the full Asset satisfies it. */
interface PickableAsset {
  id: string;
  itemDescription: string;
  propertyNumber: string | null;
  serialNumber: string | null;
  status: string;
  officeOrSection: string | null;
}

interface PickableRequisition {
  id: string;
  requestNumber: string;
  requester?: { name: string; employeeId: string } | null;
  items: Array<{ itemDescription: string }>;
}

const words = (value: string) => {
  const text = value.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function assetOption(asset: PickableAsset): PickerOption {
  const subtitle = [
    asset.propertyNumber || 'No property no.',
    asset.serialNumber || null,
    words(asset.status),
    asset.officeOrSection || null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { id: asset.id, title: asset.itemDescription, subtitle };
}

export function requisitionOption(requisition: PickableRequisition): PickerOption {
  return {
    id: requisition.id,
    title: requisition.requester ? `${requisition.requestNumber} · ${requisition.requester.name}` : requisition.requestNumber,
    subtitle: requisition.items.map((i) => i.itemDescription).join(', '),
  };
}

/** Client-side match of a typed query against a loaded requisition. */
export function requisitionMatches(requisition: PickableRequisition, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    requisition.requestNumber,
    requisition.requester?.name,
    requisition.requester?.employeeId,
    ...requisition.items.map((i) => i.itemDescription),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}
