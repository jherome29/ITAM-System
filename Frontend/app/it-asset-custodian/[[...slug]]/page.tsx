import { LaptopAssetDetail } from '@/components/assets/LaptopAssetDetail';
import { LaptopAssetForm } from '@/components/assets/LaptopAssetForm';
import { AssetInventoryGallery } from '@/components/inventory/AssetInventoryGallery';
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ItAssetCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.IT_ASSET_CUSTODIAN} />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assets' && child === 'new') return <LaptopAssetForm />;
  if (segment === 'assets' && child) return <LaptopAssetDetail assetId={child} />;
  if (segment === 'assets') return <AssetInventoryGallery kind="ict" />;
  return <WorkflowPage role={ProposedUserRole.IT_ASSET_CUSTODIAN} slug={segment} />;
}
