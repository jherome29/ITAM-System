import { humanize } from '@/lib/text';
import { Chip } from './Chip';
import type { Tone } from './tones';

// Keys are the real backend enum values (packages/shared/src/enums: AssetStatus,
// RequisitionStatus, AssetCondition, plus account state) — lowercase snake_case, NOT the
// uppercase form. A key that never matches silently falls back to the neutral grey.
const STATUS: Record<string, { tone: Tone; label: string }> = {
  // Asset statuses
  registered: { tone: 'slate', label: 'Registered' },
  available: { tone: 'green', label: 'Available' },
  issued: { tone: 'blue', label: 'Issued' },
  returned: { tone: 'slate', label: 'Returned' },
  transferred: { tone: 'blue', label: 'Transferred' },
  under_repair: { tone: 'amber', label: 'Under Repair' },
  flagged_for_disposal: { tone: 'orange', label: 'For Disposal' },
  disposed: { tone: 'slate', label: 'Disposed' },
  // Requisition statuses
  draft: { tone: 'slate', label: 'Draft' },
  pending_supervisor: { tone: 'amber', label: 'Pending Approval' },
  pending_fulfillment: { tone: 'blue', label: 'Pending Fulfillment' },
  on_hold: { tone: 'orange', label: 'On Hold' },
  fulfilled: { tone: 'green', label: 'Fulfilled' },
  rejected: { tone: 'red', label: 'Rejected' },
  cancelled: { tone: 'slate', label: 'Cancelled' },
  // Asset conditions
  serviceable: { tone: 'green', label: 'Serviceable' },
  unserviceable: { tone: 'red', label: 'Unserviceable' },
  for_disposal: { tone: 'orange', label: 'For Disposal' },
  for_repair: { tone: 'amber', label: 'For Repair' },
  // Account states
  active: { tone: 'green', label: 'Active' },
  inactive: { tone: 'slate', label: 'Inactive' },
};

/**
 * A status as a coloured badge. `label` overrides the words ("Awaiting approval") while the
 * colour still comes from the real status value, so a screen can phrase it its own way
 * without recolouring it.
 */
export function StatusBadge({ status, label }: Readonly<{ status: string; label?: string }>) {
  const known = STATUS[status];
  return <Chip tone={known?.tone ?? 'slate'}>{label ?? known?.label ?? humanize(status)}</Chip>;
}
