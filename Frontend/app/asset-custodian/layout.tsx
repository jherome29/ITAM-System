import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
export default function AssetCustodianLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell role={ProposedUserRole.ASSET_CUSTODIAN}>{children}</AppShell>;
}
