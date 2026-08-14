import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default function MasterAdminLayout({ children }: { children: ReactNode }) {
  return <AppShell role={ProposedUserRole.MASTER_ADMIN}>{children}</AppShell>;
}

