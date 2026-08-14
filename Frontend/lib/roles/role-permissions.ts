import { ProposedUserRole } from './proposed-roles';

export type UiPermission =
  | 'create_requisition'
  | 'approve_requisition'
  | 'issue_ict_assets'
  | 'issue_property'
  | 'scan_qr'
  | 'record_maintenance'
  | 'recommend_disposal'
  | 'reconcile_inventory'
  | 'manage_users'
  | 'view_reports'
  | 'view_audit'
  | 'read_only';

export const rolePermissions: Record<ProposedUserRole, UiPermission[]> = {
  [ProposedUserRole.EMPLOYEE]: ['create_requisition'],
  [ProposedUserRole.APPROVING_OFFICER]: ['approve_requisition'],
  [ProposedUserRole.IT_ASSET_CUSTODIAN]: [
    'issue_ict_assets',
    'scan_qr',
    'record_maintenance',
    'recommend_disposal',
    'reconcile_inventory',
    'view_reports',
  ],
  [ProposedUserRole.PROPERTY_CUSTODIAN]: [
    'issue_property',
    'scan_qr',
    'recommend_disposal',
    'reconcile_inventory',
    'view_reports',
  ],
  [ProposedUserRole.PROPERTY_OFFICER]: [
    'reconcile_inventory',
    'recommend_disposal',
    'view_reports',
    'view_audit',
  ],
  [ProposedUserRole.MASTER_ADMIN]: ['manage_users', 'view_audit'],
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: ['view_reports', 'view_audit', 'read_only'],
};

export function hasUiPermission(role: ProposedUserRole, permission: UiPermission) {
  return rolePermissions[role].includes(permission);
}

