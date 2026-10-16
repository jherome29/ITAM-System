import type { Asset } from '@/lib/api/assets';
import { formatDate } from '@/lib/requisitions/requisition-view';

// How an asset from GET /v1/assets reads in the custodians' Custody & Issuance and
// Disposal tables. The list carries the holder as a small summary (name + employee
// ID), so the page can say who has what instead of showing a UUID or a dash.

export type AssetRow = Record<string, string | number | boolean | string[] | undefined>;

/** "Juan dela Cruz (CICC-EMP-001)", or "Not issued" when nobody holds it. */
export function heldByLabel(asset: Pick<Asset, 'custodian'>): string {
  const holder = asset.custodian;
  return holder ? `${holder.name} (${holder.employeeId})` : 'Not issued';
}

/** Units someone can hold — not supply lines (IES), which are stock issued by requisition. */
export function unitAssets(assets: Asset[]): Asset[] {
  return assets.filter((a) => a.assetClass !== 'IES');
}

/** "under_repair" -> "Under repair"; "—" when there is nothing to show. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value.replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The return date of an asset still out on loan; `overdue` once that day has passed. */
export function dueBack(
  asset: Pick<Asset, 'status' | 'expectedReturnDate'>,
  now = Date.now(),
): { label: string; date: string; overdue: boolean } | null {
  if (asset.status !== 'issued' || !asset.expectedReturnDate) return null;
  const day = /^\d{4}-\d{2}-\d{2}/.exec(asset.expectedReturnDate)?.[0];
  if (!day) return null;
  const today = new Date(now).toISOString().slice(0, 10);
  const date = formatDate(day);
  return { label: `Due back ${date}`, date, overdue: day < today };
}

export function assetApiToRow(asset: Asset): AssetRow {
  const due = dueBack(asset);
  return {
    id: asset.id,
    item: asset.itemDescription,
    propertyNumber: asset.propertyNumber,
    serialNumber: asset.serialNumber,
    status: asset.status,
    condition: asset.condition,
    location: asset.officeOrSection,
    heldBy: heldByLabel(asset),
    dueBack: due?.label ?? '',
    returnDate: due?.date ?? '',
    overdue: due?.overdue ?? false,
  };
}
