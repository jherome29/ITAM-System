import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { AssetInventoryGallery } from '@/components/inventory/AssetInventoryGallery';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyCustodianPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.PROPERTY_CUSTODIAN} />;
  if (segment === 'fixed-assets') return <AssetInventoryGallery kind="property" />;
  if (segment === 'supplies') return <AssetInventoryGallery kind="supply" />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_CUSTODIAN} slug={segment} />;
}
