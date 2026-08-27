import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { PropertyOfficerDashboard } from '@/components/property-officer/PropertyOfficerDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { FormsArchiveContent } from '@/components/shared/FormsArchiveContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyOfficerPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <PropertyOfficerDashboard />;
  if (segment === 'assets' && child === 'new') return <RegisterAssetForm basePath="/property-officer/assets" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/property-officer/assets" formsPath="/it-personnel/forms" />;
  if (segment === 'assets') return <AssetRegistryList basePath="/property-officer/assets" />;
  if (segment === 'reports') return <FormsArchiveContent />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_OFFICER} slug={segment} />;
}
