import type { Notification } from '@/lib/api/notifications';

// Outcome alerts about a request the user *submitted* — these belong on their
// own "My Requisitions" view, not on the queue they work as an approver or
// custodian.
const OWN_REQUEST_OUTCOMES = new Set([
  'requisition_approved',
  'requisition_rejected',
  'requisition_fulfilled',
]);

/**
 * Where clicking a notification should take the user, or null when there is no
 * page for that record in this role's workspace (the caller falls back to the
 * notifications inbox).
 *
 * `basePath` is the role workspace root, e.g. '/approving-officer'. Queue pages
 * take `?open=<id>` and open that request's detail drawer on arrival.
 */
type Target = (basePath: string, id: string, alertType: string) => string | null;
const CUSTODIAN_BASES = new Set(['/it-asset-custodian', '/property-custodian']);
const openParam = (id: string) => `?open=${encodeURIComponent(id)}`;

const requisitionTarget: Target = (basePath, id, alertType) => {
  const open = openParam(id);
  const isOwnOutcome = OWN_REQUEST_OUTCOMES.has(alertType);
  switch (basePath) {
    case '/employee':
      return `/employee/requisitions/${encodeURIComponent(id)}`;
    case '/approving-officer':
      return isOwnOutcome ? `/approving-officer/requisitions${open}` : `/approving-officer/approvals${open}`;
    case '/it-asset-custodian':
      return isOwnOutcome ? `/it-asset-custodian/requisitions${open}` : `/it-asset-custodian/fulfillment${open}`;
    case '/property-custodian':
      return `/property-custodian/fulfillment${open}`;
    default:
      return null;
  }
};

// Returns & Incidents: the holder's alerts (approved / rejected / completed)
// open their own list; custodians' alerts (new / cancelled) open the queue.
const assetRequestTarget: Target = (basePath, id, alertType) => {
  if (basePath === '/employee') return `/employee/returns-incidents${openParam(id)}`;
  if (CUSTODIAN_BASES.has(basePath) && alertType === 'asset_request') {
    return `${basePath}/returns-incidents${openParam(id)}`;
  }
  return null;
};

const assetTarget: Target = (basePath, id) =>
  CUSTODIAN_BASES.has(basePath) ? `${basePath}/assets/${encodeURIComponent(id)}` : null;

const TARGETS: Record<string, Target> = {
  requisition: requisitionTarget,
  asset_request: assetRequestTarget,
  asset: assetTarget,
};

export function notificationTarget(
  basePath: string,
  n: Pick<Notification, 'alertType' | 'relatedRecordId' | 'relatedRecordType'>,
): string | null {
  const target = n.relatedRecordType ? TARGETS[n.relatedRecordType] : undefined;
  if (!n.relatedRecordId || !target) return null;
  return target(basePath, n.relatedRecordId, n.alertType);
}

/** '/approving-officer/approvals' → '/approving-officer'. */
export function workspaceBasePath(pathname: string): string {
  const first = pathname.split('/').find(Boolean);
  return first ? `/${first}` : '';
}
