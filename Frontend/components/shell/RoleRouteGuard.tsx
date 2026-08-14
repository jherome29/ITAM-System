import type { ReactNode } from 'react';
import { ErrorState } from '@/components/states/ErrorState';
import type { ProposedUserRole } from '@/lib/roles/proposed-roles';

export function RoleRouteGuard({ allowed, role, children }: { allowed: ProposedUserRole[]; role: ProposedUserRole; children: ReactNode }) {
  // Frontend-only prototype.
  // Backend authorization and persistence will be implemented in a later phase.
  if (!allowed.includes(role)) {
    return <ErrorState title="Forbidden preview state" detail="This frontend route is not presented for the current preview role." />;
  }
  return <>{children}</>;
}

