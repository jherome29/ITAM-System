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
  if (segment === 'assets' && child === 'new') return <RegisterAssetForm basePath="/it-asset-custodian/assets" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/it-asset-custodian/assets" formsPath="/it-asset-custodian/reports" />;
  if (segment === 'assets') return <AssetRegistryList basePath="/it-asset-custodian/assets" />;
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/it-asset-custodian/assets" />;
  if (segment === 'reports') return <FormsWorkspaceContent />;
  if (segment === 'returns-incidents') return <AssetRequestQueue eyebrow="IT Asset Custodian" openId={typeof open === 'string' ? open : undefined} />;
  return <WorkflowPage role={ProposedUserRole.IT_ASSET_CUSTODIAN} slug={segment} openId={typeof open === 'string' ? open : undefined} />;
}
