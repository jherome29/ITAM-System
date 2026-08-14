import type { ReactNode } from 'react';
import { hasUiPermission, type UiPermission } from '@/lib/roles/role-permissions';
import type { ProposedUserRole } from '@/lib/roles/proposed-roles';

export function PermissionGate({ role, permission, children }: { role: ProposedUserRole; permission: UiPermission; children: ReactNode }) {
  // Frontend-only access presentation.
  // Backend authorization must be implemented in a later phase.
  if (!hasUiPermission(role, permission)) return null;
  return <>{children}</>;
}

