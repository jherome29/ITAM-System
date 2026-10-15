import { ASSET_LIFECYCLE_TRANSITIONS } from '@/lib/assets/lifecycle-transitions';

// The buttons WorkflowPage offers, per page. Each one maps to a real backend
// action, and each is offered only while the backend would accept it - a button
// that fails with a 400 (or, worse, once saved nothing at all) is worse than none.

/** The custody action that moves an asset into a given status. */
const CUSTODY_ACTION_FOR_STATUS: Record<string, string> = {
  issued: 'Issue',
  transferred: 'Transfer',
  returned: 'Return',
};

/** Label of the blue per-row button. */
export function rowActionLabel(slug: string): string {
  switch (slug) {
    case 'approvals':
      return 'Review';
    case 'fulfillment':
      return 'Fulfill';
    case 'custody':
      return 'Manage';
    case 'disposal':
      return 'Recommend Disposal';
    default:
      return 'Open';
  }
}

/** Actions offered in a record's drawer, given its current status. */
export function detailActions(slug: string, status = ''): string[] {
  switch (slug) {
    case 'approvals':
      return status === 'pending_supervisor' ? ['Approve', 'Reject'] : [];
    case 'fulfillment':
      if (status === 'pending_fulfillment') return ['Fulfill', 'On Hold'];
      return status === 'on_hold' ? ['Fulfill'] : [];
    case 'custody':
      return (ASSET_LIFECYCLE_TRANSITIONS[status] ?? [])
        .map((next) => CUSTODY_ACTION_FOR_STATUS[next])
        .filter((action): action is string => Boolean(action));
    case 'disposal':
      return (ASSET_LIFECYCLE_TRANSITIONS[status] ?? []).includes('flagged_for_disposal')
        ? ['Recommend Disposal']
        : [];
    default:
      // 'requisitions' (My Requisitions) is view-only: there is no cancel endpoint.
      return [];
  }
}
