import type { Asset } from '@/lib/api/assets';

export interface CountRow {
  location: string;
  /** Asset records (one per equipment item; one per supply line). */
  items: number;
  /** Units on hand — equal to items for equipment, the quantity for supply lines. */
  units: number;
  available: number;
  issued: number;
  underRepair: number;
  /** Flagged for disposal, returned, registered, transferred. */
  other: number;
}

export interface CountSheet {
  rows: CountRow[];
  totals: Omit<CountRow, 'location'>;
}

const locationOf = (a: Asset) => a.officeLocation?.trim() || a.officeOrSection?.trim() || 'Unspecified';

/**
 * What the system expects to find at each place — the sheet a custodian counts
 * against. Disposed assets are gone, so they are left out. (The system does not
 * record the physical count itself, only this expectation.)
 */
export function buildCountSheet(assets: Asset[]): CountSheet {
  const byLocation = new Map<string, CountRow>();
  for (const a of assets) {
    if (a.status === 'disposed') continue;
    const location = locationOf(a);
    const row = byLocation.get(location) ?? { location, items: 0, units: 0, available: 0, issued: 0, underRepair: 0, other: 0 };
    row.items += 1;
    row.units += Number.isFinite(a.quantity) ? a.quantity : 1;
    if (a.status === 'available') row.available += 1;
    else if (a.status === 'issued') row.issued += 1;
    else if (a.status === 'under_repair') row.underRepair += 1;
    else row.other += 1;
    byLocation.set(location, row);
  }
  const rows = [...byLocation.values()].sort((x, y) => x.location.localeCompare(y.location));
  const totals = rows.reduce(
    (t, r) => ({
      items: t.items + r.items,
      units: t.units + r.units,
      available: t.available + r.available,
      issued: t.issued + r.issued,
      underRepair: t.underRepair + r.underRepair,
      other: t.other + r.other,
    }),
    { items: 0, units: 0, available: 0, issued: 0, underRepair: 0, other: 0 },
  );
  return { rows, totals };
}
