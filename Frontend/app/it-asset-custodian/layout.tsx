import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default function ItAssetCustodianLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell role={ProposedUserRole.IT_ASSET_CUSTODIAN}>{children}</AppShell>;
}

