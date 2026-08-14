export enum ProposedUserRole {
  EMPLOYEE = 'employee',
  APPROVING_OFFICER = 'approving_officer',
  IT_ASSET_CUSTODIAN = 'it_asset_custodian',
  PROPERTY_CUSTODIAN = 'property_custodian',
  PROPERTY_OFFICER = 'property_officer',
  MASTER_ADMIN = 'master_admin',
  MANAGEMENT_AUDIT_VIEWER = 'management_audit_viewer',
}

export const proposedRoleLabels: Record<ProposedUserRole, string> = {
  [ProposedUserRole.EMPLOYEE]: 'Employee',
  [ProposedUserRole.APPROVING_OFFICER]: 'Approving Officer',
  [ProposedUserRole.IT_ASSET_CUSTODIAN]: 'IT Asset Custodian',
  [ProposedUserRole.PROPERTY_CUSTODIAN]: 'Property Custodian',
  [ProposedUserRole.PROPERTY_OFFICER]: 'Property Officer',
  [ProposedUserRole.MASTER_ADMIN]: 'Master Administrator',
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: 'Management & Audit Viewer',
};

export const roleHomePaths: Record<ProposedUserRole, string> = {
  [ProposedUserRole.EMPLOYEE]: '/employee/dashboard',
  [ProposedUserRole.APPROVING_OFFICER]: '/approving-officer/dashboard',
  [ProposedUserRole.IT_ASSET_CUSTODIAN]: '/it-asset-custodian/dashboard',
  [ProposedUserRole.PROPERTY_CUSTODIAN]: '/property-custodian/dashboard',
  [ProposedUserRole.PROPERTY_OFFICER]: '/property-officer/dashboard',
  [ProposedUserRole.MASTER_ADMIN]: '/master-admin/dashboard',
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: '/management-audit/dashboard',
};

export const roleRouteSegments: Record<ProposedUserRole, string> = {
  [ProposedUserRole.EMPLOYEE]: 'employee',
  [ProposedUserRole.APPROVING_OFFICER]: 'approving-officer',
  [ProposedUserRole.IT_ASSET_CUSTODIAN]: 'it-asset-custodian',
  [ProposedUserRole.PROPERTY_CUSTODIAN]: 'property-custodian',
  [ProposedUserRole.PROPERTY_OFFICER]: 'property-officer',
  [ProposedUserRole.MASTER_ADMIN]: 'master-admin',
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: 'management-audit',
};

