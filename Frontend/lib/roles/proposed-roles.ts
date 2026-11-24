export enum ProposedUserRole {
  EMPLOYEE = 'employee',
  APPROVING_OFFICER = 'approving_officer',
  ASSET_CUSTODIAN = 'asset_custodian',
  PROPERTY_OFFICER = 'property_officer',
  MASTER_ADMIN = 'master_admin',
  MANAGEMENT_AUDIT_VIEWER = 'management_audit_viewer',
}

export const proposedRoleLabels: Record<ProposedUserRole, string> = {
  [ProposedUserRole.EMPLOYEE]: 'Employee',
  [ProposedUserRole.APPROVING_OFFICER]: 'Approving Officer',
  [ProposedUserRole.ASSET_CUSTODIAN]: 'Asset Custodian',
  [ProposedUserRole.PROPERTY_OFFICER]: 'Property Officer',
  [ProposedUserRole.MASTER_ADMIN]: 'Master Administrator',
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: 'Management & Audit Viewer',
};

export const roleHomePaths: Record<ProposedUserRole, string> = {
  [ProposedUserRole.EMPLOYEE]: '/employee/dashboard',
  [ProposedUserRole.APPROVING_OFFICER]: '/approving-officer/dashboard',
  [ProposedUserRole.ASSET_CUSTODIAN]: '/asset-custodian/dashboard',
  [ProposedUserRole.PROPERTY_OFFICER]: '/property-officer/dashboard',
  [ProposedUserRole.MASTER_ADMIN]: '/master-admin/dashboard',
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: '/management-audit/dashboard',
};

export const roleRouteSegments: Record<ProposedUserRole, string> = {
  [ProposedUserRole.EMPLOYEE]: 'employee',
  [ProposedUserRole.APPROVING_OFFICER]: 'approving-officer',
  [ProposedUserRole.ASSET_CUSTODIAN]: 'asset-custodian',
  [ProposedUserRole.PROPERTY_OFFICER]: 'property-officer',
  [ProposedUserRole.MASTER_ADMIN]: 'master-admin',
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: 'management-audit',
};

