import { AssetRequestQueue } from '@/components/asset-requests/AssetRequestQueue';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { QrLookup } from '@/components/assets/QrLookup';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { PropertyCustodianDashboard } from '@/components/property-custodian/PropertyCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { FormsWorkspaceContent } from '@/components/shared/FormsWorkspaceContent';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyCustodianPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ slug?: string[] }>; searchParams: Promise<{ open?: string | string[] }> }>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <PropertyCustodianDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'fixed-assets' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/fixed-assets" />;
  if (segment === 'fixed-assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/fixed-assets" formsPath="/property-custodian/reports" />;
  if (segment === 'fixed-assets') return <AssetRegistryList basePath="/property-custodian/fixed-assets" assetType="Fixed" title="Fixed Asset Registry" />;
  if (segment === 'supplies' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/supplies" />;
  if (segment === 'supplies' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/supplies" formsPath="/property-custodian/reports" />;
  if (segment === 'supplies') return <AssetRegistryList basePath="/property-custodian/supplies" assetType="Supplies" title="Supply Inventory" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/assets" formsPath="/property-custodian/reports" />;
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/property-custodian/assets" />;
  if (segment === 'reports') return <FormsWorkspaceContent />;
  if (segment === 'returns-incidents') return <AssetRequestQueue eyebrow="Property Custodian" openId={typeof open === 'string' ? open : undefined} />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_CUSTODIAN} slug={segment} openId={typeof open === 'string' ? open : undefined} />;
}
