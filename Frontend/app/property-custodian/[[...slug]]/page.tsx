import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { QrLookup } from '@/components/assets/QrLookup';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { PropertyCustodianDashboard } from '@/components/property-custodian/PropertyCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <PropertyCustodianDashboard />;
  if (segment === 'fixed-assets' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/fixed-assets" />;
  if (segment === 'fixed-assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/fixed-assets" formsPath="/it-personnel/forms" />;
  if (segment === 'fixed-assets') return <AssetRegistryList basePath="/property-custodian/fixed-assets" assetType="Fixed" title="Fixed Asset Registry" />;
  if (segment === 'supplies' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/supplies" />;
  if (segment === 'supplies' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/supplies" formsPath="/it-personnel/forms" />;
  if (segment === 'supplies') return <AssetRegistryList basePath="/property-custodian/supplies" assetType="Supplies" title="Supply Inventory" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/assets" formsPath="/it-personnel/forms" />;
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/property-custodian/assets" />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_CUSTODIAN} slug={segment} />;
}
