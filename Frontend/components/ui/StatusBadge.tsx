// Keys match the real backend enum values (packages/shared/src/enums/index.ts
// AssetStatus, RequisitionStatus, AssetCondition), which are all lowercase
// snake_case — NOT the uppercase form. Uppercase keys here would never match
// a real API response and would silently fall back to the generic style.
const STATUS_STYLES: Record<string, string> = {
  // Asset statuses
  registered: 'bg-gray-100 text-gray-700',
  available: 'bg-green-100 text-green-700',
  issued: 'bg-blue-100 text-blue-700',
  returned: 'bg-teal-100 text-teal-700',
  transferred: 'bg-purple-100 text-purple-700',
  under_repair: 'bg-yellow-100 text-yellow-700',
  flagged_for_disposal: 'bg-orange-100 text-orange-700',
  disposed: 'bg-red-100 text-red-700',
  // Requisition statuses
  draft: 'bg-gray-100 text-gray-700',
  pending_supervisor: 'bg-yellow-100 text-yellow-700',
  pending_fulfillment: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-orange-100 text-orange-700',
  fulfilled: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  // Asset conditions
  serviceable: 'bg-green-100 text-green-700',
  unserviceable: 'bg-red-100 text-red-700',
  for_disposal: 'bg-orange-100 text-orange-700',
  for_repair: 'bg-yellow-100 text-yellow-700',
  // User account statuses
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registered',
  available: 'Available',
  issued: 'Issued',
  returned: 'Returned',
  transferred: 'Transferred',
  under_repair: 'Under Repair',
  flagged_for_disposal: 'For Disposal',
  disposed: 'Disposed',
  draft: 'Draft',
  pending_supervisor: 'Pending Approval',
  pending_fulfillment: 'Pending Fulfillment',
  on_hold: 'On Hold',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  serviceable: 'Serviceable',
  unserviceable: 'Unserviceable',
  for_disposal: 'For Disposal',
  for_repair: 'For Repair',
  active: 'Active',
  inactive: 'Inactive',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles} ${className}`}
    >
      {label}
    </span>
  );
}
