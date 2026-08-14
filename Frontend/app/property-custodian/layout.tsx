import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default function PropertyCustodianLayout({ children }: { children: ReactNode }) {
  return <AppShell role={ProposedUserRole.PROPERTY_CUSTODIAN}>{children}</AppShell>;
}

