import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default function ApprovingOfficerLayout({ children }: { children: ReactNode }) {
  return <AppShell role={ProposedUserRole.APPROVING_OFFICER}>{children}</AppShell>;
}

