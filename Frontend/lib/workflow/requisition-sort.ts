// Sort choices for the live requisition tables (approval queue, fulfillment
// queue, My Requisitions). Newest submission first by default, so a request
// that was just routed to you sits at the top instead of wherever its UUID
// happens to fall alphabetically.
export const REQUISITION_SORT_OPTIONS = [
  'Newest first',
  'Oldest first',
  'Required by (soonest)',
  'Status',
  'Item',
] as const;

export const DEFAULT_REQUISITION_SORT = REQUISITION_SORT_OPTIONS[0];

interface SortableRequisitionRow {
  submittedDate?: unknown;
  requiredDate?: unknown;
  status?: unknown;
  item?: unknown;
}

// Unparseable / missing dates sort as epoch 0 — last under "Newest first",
// first under the ascending options — rather than throwing off the comparator.
function time(value: unknown): number {
  const t = Date.parse(String(value ?? ''));
  return Number.isNaN(t) ? 0 : t;
}

export function compareRequisitionRows(
  option: string,
  a: SortableRequisitionRow,
  b: SortableRequisitionRow,
): number {
  switch (option) {
    case 'Oldest first':
      return time(a.submittedDate) - time(b.submittedDate);
    case 'Required by (soonest)':
      return time(a.requiredDate) - time(b.requiredDate);
    case 'Status':
      return String(a.status ?? '').localeCompare(String(b.status ?? ''));
    case 'Item':
      return String(a.item ?? '').localeCompare(String(b.item ?? ''));
    default:
      return time(b.submittedDate) - time(a.submittedDate);
  }
}
