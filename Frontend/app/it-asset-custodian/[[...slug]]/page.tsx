import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { QrLookup } from '@/components/assets/QrLookup';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
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
  if (segment === 'assets' && child === 'new') return <RegisterAssetForm basePath="/it-asset-custodian/assets" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/it-asset-custodian/assets" formsPath="/it-personnel/forms" />;
  if (segment === 'assets') return <AssetRegistryList basePath="/it-asset-custodian/assets" />;
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/it-asset-custodian/assets" />;
  return <WorkflowPage role={ProposedUserRole.IT_ASSET_CUSTODIAN} slug={segment} />;
}
