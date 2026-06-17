const STATUS_STYLES: Record<string, string> = {
  // Asset statuses
  REGISTERED: 'bg-gray-100 text-gray-700',
  AVAILABLE: 'bg-green-100 text-green-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  RETURNED: 'bg-teal-100 text-teal-700',
  TRANSFERRED: 'bg-purple-100 text-purple-700',
  UNDER_REPAIR: 'bg-yellow-100 text-yellow-700',
  FLAGGED_FOR_DISPOSAL: 'bg-orange-100 text-orange-700',
  DISPOSED: 'bg-red-100 text-red-700',
  // Requisition statuses
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_SUPERVISOR: 'bg-yellow-100 text-yellow-700',
  PENDING_FULFILLMENT: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  FULFILLED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  // Asset conditions
  SERVICEABLE: 'bg-green-100 text-green-700',
  UNSERVICEABLE: 'bg-red-100 text-red-700',
  FOR_DISPOSAL: 'bg-orange-100 text-orange-700',
  FOR_REPAIR: 'bg-yellow-100 text-yellow-700',
  // User account statuses
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: 'Registered',
  AVAILABLE: 'Available',
  ISSUED: 'Issued',
  RETURNED: 'Returned',
  TRANSFERRED: 'Transferred',
  UNDER_REPAIR: 'Under Repair',
  FLAGGED_FOR_DISPOSAL: 'For Disposal',
  DISPOSED: 'Disposed',
  DRAFT: 'Draft',
  PENDING_SUPERVISOR: 'Pending Approval',
  PENDING_FULFILLMENT: 'Pending Fulfillment',
  ON_HOLD: 'On Hold',
  FULFILLED: 'Fulfilled',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  SERVICEABLE: 'Serviceable',
  UNSERVICEABLE: 'Unserviceable',
  FOR_DISPOSAL: 'For Disposal',
  FOR_REPAIR: 'For Repair',
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
