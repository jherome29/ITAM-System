import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default function ManagementAuditLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER}>{children}</AppShell>;
}

