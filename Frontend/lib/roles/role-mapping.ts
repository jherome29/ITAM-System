import { ProposedUserRole } from './proposed-roles';

export const frontendRoleMapping: Record<string, ProposedUserRole> = {
  employee: ProposedUserRole.EMPLOYEE,
  supervisor: ProposedUserRole.APPROVING_OFFICER,
  it_personnel: ProposedUserRole.IT_ASSET_CUSTODIAN,
  system_admin: ProposedUserRole.MASTER_ADMIN,
  management: ProposedUserRole.MANAGEMENT_AUDIT_VIEWER,
};

export function mapBackendRoleToProposedRole(role?: string | null): ProposedUserRole {
  if (!role) return ProposedUserRole.EMPLOYEE;
  return frontendRoleMapping[role] ?? ProposedUserRole.EMPLOYEE;
}

