// Pure helpers for the requisition item picker — kept out of the components so
// they can be unit-tested in vitest's node environment.

/** The form's hard ceiling on requested quantity (matches the input max). */
export const MAX_REQUEST_QUANTITY = 99;

type Availability = { available: number; isSupply: boolean };

export function formatAvailability(item: Availability): string {
  return item.isSupply ? `${item.available} on hand` : `${item.available} available`;
}

/** A picked item can't be requested beyond what inventory holds; a typed-in
 *  item has no known stock, so only the form ceiling applies. */
export function maxRequestQuantity(item: Availability | null): number {
  return item ? Math.min(item.available, MAX_REQUEST_QUANTITY) : MAX_REQUEST_QUANTITY;
}

/** Queue/list label for a requisition's lines. Flags lines the server found
 *  no available inventory match for at submission. `inInventory` is absent on
 *  rows that predate the flag — those are left unmarked rather than guessed. */
export function requisitionItemsLabel(
  items: ReadonlyArray<{ itemDescription: string; inInventory?: boolean }>,
): string {
  return items
    .map((i) => (i.inInventory === false ? `${i.itemDescription} (not in inventory)` : i.itemDescription))
    .join(', ');
}
