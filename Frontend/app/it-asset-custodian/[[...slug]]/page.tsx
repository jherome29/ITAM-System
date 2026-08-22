import { LaptopAssetDetail } from '@/components/assets/LaptopAssetDetail';
import { LaptopAssetForm } from '@/components/assets/LaptopAssetForm';
import { QrLookup } from '@/components/assets/QrLookup';
import { AssetInventoryGallery } from '@/components/inventory/AssetInventoryGallery';
import { ItAssetCustodianDashboard } from '@/components/it-asset-custodian/ItAssetCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ItAssetCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <ItAssetCustodianDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assets' && child === 'new') return <LaptopAssetForm />;
  if (segment === 'assets' && child) return <LaptopAssetDetail assetId={child} />;
  if (segment === 'assets') return <AssetInventoryGallery kind="ict" />;
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/it-asset-custodian/assets" />;
  return <WorkflowPage role={ProposedUserRole.IT_ASSET_CUSTODIAN} slug={segment} />;
}
