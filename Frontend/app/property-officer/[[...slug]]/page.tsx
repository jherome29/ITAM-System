import { MyAssignedAssets } from '@/components/assets/MyAssignedAssets';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { PropertyOfficerDashboard } from '@/components/property-officer/PropertyOfficerDashboard';
import { ReplacementReview } from '@/components/requisitions/ReplacementReview';
import { DisposalReview } from '@/components/assets/DisposalReview';
import { notFound } from 'next/navigation';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { FormsArchiveContent } from '@/components/shared/FormsArchiveContent';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { isLiveWorkflowPage } from '@/lib/workflow/live-pages';

export default async function PropertyOfficerPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ slug?: string[] }>; searchParams: Promise<{ open?: string | string[] }> }>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <PropertyOfficerDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assigned-assets') return <MyAssignedAssets eyebrow="Property Officer" canRequestReplacement={false} showRequestHistory openId={typeof open === 'string' ? open : undefined} />;
  if (segment === 'assets' && child === 'new') return <RegisterAssetForm basePath="/property-officer/assets" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/property-officer/assets" formsPath="/it-personnel/forms" />;
  if (segment === 'assets') return <AssetRegistryList basePath="/property-officer/assets" title="Consolidated Asset Registry" />;
  if (segment === 'reports') return <FormsArchiveContent />;
  if (segment === 'replacements' || segment === 'replacement-validation') return <ReplacementReview eyebrow="Property Officer" assetBasePath="/property-officer/assets" />;
  if (segment === 'disposal' || segment === 'disposal-review') return <DisposalReview eyebrow="Property Officer" assetBasePath="/property-officer/assets" />;
  // Only pages wired to real records may reach WorkflowPage; anything else is sample
  // data, so it is not found (see lib/workflow/live-pages.ts).
  if (!isLiveWorkflowPage(ProposedUserRole.PROPERTY_OFFICER, segment)) notFound();
  return <WorkflowPage role={ProposedUserRole.PROPERTY_OFFICER} slug={segment} />;
}
