import { MyAssignedAssets } from '@/components/assets/MyAssignedAssets';
import { RepairQueue } from '@/components/repairs/RepairQueue';
import { AssetRequestQueue } from '@/components/asset-requests/AssetRequestQueue';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { QrLookup } from '@/components/assets/QrLookup';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { ItAssetCustodianDashboard } from '@/components/it-asset-custodian/ItAssetCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { FormsWorkspaceContent } from '@/components/shared/FormsWorkspaceContent';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ItAssetCustodianPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ slug?: string[] }>; searchParams: Promise<{ open?: string | string[] }> }>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <ItAssetCustodianDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assigned-assets') return <MyAssignedAssets eyebrow="IT Asset Custodian" canRequestReplacement showRequestHistory openId={typeof open === 'string' ? open : undefined} />;
  if (segment === 'assets' && child === 'new') return <RegisterAssetForm basePath="/it-asset-custodian/assets" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/it-asset-custodian/assets" formsPath="/it-asset-custodian/reports" />;
  if (segment === 'assets') return <AssetRegistryList basePath="/it-asset-custodian/assets" />;
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/it-asset-custodian/assets" />;
  if (segment === 'reports') return <FormsWorkspaceContent />;
  if (segment === 'maintenance') return <RepairQueue eyebrow="IT Asset Custodian" assetBasePath="/it-asset-custodian/assets" openId={typeof open === 'string' ? open : undefined} />;
  if (segment === 'returns-incidents') return <AssetRequestQueue eyebrow="IT Asset Custodian" openId={typeof open === 'string' ? open : undefined} />;
  return <WorkflowPage role={ProposedUserRole.IT_ASSET_CUSTODIAN} slug={segment} openId={typeof open === 'string' ? open : undefined} />;
}
