import { ProposedUserRole } from './proposed-roles';

export const frontendRoleMapping: Record<string, ProposedUserRole> = {
  asset_custodian: ProposedUserRole.ASSET_CUSTODIAN,
  employee: ProposedUserRole.EMPLOYEE,
  supervisor: ProposedUserRole.APPROVING_OFFICER,
  it_personnel: ProposedUserRole.ASSET_CUSTODIAN,
  system_admin: ProposedUserRole.MASTER_ADMIN,
  management: ProposedUserRole.MANAGEMENT_AUDIT_VIEWER,
  property_custodian: ProposedUserRole.ASSET_CUSTODIAN,
  property_officer: ProposedUserRole.PROPERTY_OFFICER,
};

export function mapBackendRoleToProposedRole(role?: string | null): ProposedUserRole {
  if (!role) return ProposedUserRole.EMPLOYEE;
  return frontendRoleMapping[role] ?? ProposedUserRole.EMPLOYEE;
}

