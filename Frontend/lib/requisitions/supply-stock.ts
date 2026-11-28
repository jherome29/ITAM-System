import type { Asset } from '@/lib/api/assets';

// Fulfilling a supply (IES) requisition draws the quantity out of one stock
// record. The server picks one when the custodian names none (same item, same
// asset type, still available, oldest delivery that holds the whole quantity);
// these helpers apply the same rules on the Fulfil screen so the custodian sees
// - and can change - exactly where the stock will come from.

/** What the screen needs of a requisition line. */
export interface SupplyLine {
  id: string;
  itemDescription: string;
  assetType: string;
  assetClass: string;
  quantity: number;
}

export interface StockOption {
  id: string;
  label: string;
  onHand: number;
  /** Quantity left in the record after this line is drawn. */
  remaining: number;
  /** The record holds the whole quantity. */
  enough: boolean;
}

const normalize = (name: string | null | undefined) =>
  (name ?? '').trim().replaceAll(/\s+/g, ' ').toLowerCase();

const received = (a: Asset) => new Date(a.dateOfDelivery || a.createdAt).getTime();

export const isSupplyLine = (line: Pick<SupplyLine, 'assetClass'>): boolean => line.assetClass === 'IES';

/** Stock records a supply line can draw from, oldest delivery first. */
export function stockOptionsFor(
  line: Pick<SupplyLine, 'itemDescription' | 'assetType' | 'quantity'>,
  assets: readonly Asset[],
): StockOption[] {
  return assets
    .filter(
      (a) =>
        a.assetClass === 'IES' &&
        a.status === 'available' &&
        a.assetType === line.assetType &&
        normalize(a.itemDescription) === normalize(line.itemDescription),
    )
    .sort((a, b) => received(a) - received(b))
    .map((a) => ({
      id: a.id,
      label: [a.officeLocation, `${a.quantity} on hand`].filter(Boolean).join(' · '),
      onHand: a.quantity,
      remaining: a.quantity - line.quantity,
      enough: a.quantity >= line.quantity,
    }));
}

/** The record to preselect: the oldest that holds the whole quantity, or '' when none does. */
export function defaultStockId(options: readonly StockOption[]): string {
  return options.find((o) => o.enough)?.id ?? '';
}

/** Why a line cannot be fulfilled from the chosen record, or null when it can. */
export function stockProblem(
  line: Pick<SupplyLine, 'itemDescription' | 'quantity'>,
  options: readonly StockOption[],
  chosenId: string,
): string | null {
  if (options.length === 0) {
    return `No stock on record for "${line.itemDescription}". Register it first, or put the request on hold.`;
  }
  const chosen = options.find((o) => o.id === chosenId);
  if (chosen) {
    return chosen.enough
      ? null
      : `Not enough stock in that record: ${line.quantity} requested, ${chosen.onHand} on hand.`;
  }
  if (!options.some((o) => o.enough)) {
    const largest = Math.max(...options.map((o) => o.onHand));
    return `Not enough stock: ${line.quantity} requested, the largest record holds ${largest}.`;
  }
  return null;
}

/** The `fulfilledItems` to send: the chosen record for each supply line; units and unpicked lines are left out. */
export function fulfilledItemsFor(
  lines: readonly Pick<SupplyLine, 'id' | 'assetClass'>[],
  picks: Readonly<Record<string, string>>,
): Array<{ requisitionItemId: string; assetId: string }> {
  return lines
    .filter((line) => isSupplyLine(line) && picks[line.id])
    .map((line) => ({ requisitionItemId: line.id, assetId: picks[line.id] }));
}
