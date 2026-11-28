import { notFound, redirect } from 'next/navigation';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { QrLookup } from '@/components/assets/QrLookup';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { ItAssetCustodianDashboard } from '@/components/it-asset-custodian/ItAssetCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { MyAssignedAssets } from '@/components/assets/MyAssignedAssets';
import { RepairQueue } from '@/components/repairs/RepairQueue';
import { AssetRequestQueue } from '@/components/asset-requests/AssetRequestQueue';
import { PhysicalInventorySheet } from '@/components/assets/PhysicalInventorySheet';
import { ReportsContent } from '@/components/shared/ReportsContent';
import { FormsWorkspaceContent } from '@/components/shared/FormsWorkspaceContent';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { isLiveWorkflowPage } from '@/lib/workflow/live-pages';

const inventories: Record<string, { type?: string; title: string }> = {
  'it-inventory': { type: 'ICT', title: 'IT Inventory' },
  'fixed-assets': { type: 'Fixed', title: 'Fixed Asset Inventory' },
  supplies: { type: 'Supplies', title: 'Supplies Inventory' },
  assets: { title: 'All Assets' },
};
const disposedTypes = { it: 'ICT', fixed: 'Fixed', supplies: 'Supplies' } as const;

export default async function AssetCustodianPage({ params, searchParams }: Readonly<{
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ open?: string | string[] }>;
}>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const openId = typeof open === 'string' ? open : undefined;
  const eyebrow = 'Asset Custodian';
  const assetBasePath = '/asset-custodian/assets';
  const formsPath = '/asset-custodian/reports';
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  const basePath = '/asset-custodian/' + segment;
  if (segment === 'dashboard') return <ItAssetCustodianDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assigned-assets') return <MyAssignedAssets eyebrow={eyebrow} canRequestReplacement showRequestHistory openId={openId} />;
  if (segment === 'management-reports') return <ReportsContent eyebrow={eyebrow} />;
  if (segment === 'maintenance') return <RepairQueue eyebrow={eyebrow} assetBasePath={assetBasePath} openId={openId} />;
  if (segment === 'returns-incidents') return <AssetRequestQueue eyebrow={eyebrow} openId={openId} />;
  if (segment === 'physical-inventory') return <PhysicalInventorySheet eyebrow={eyebrow} formsPath={formsPath} />;
  if (segment === 'replacements' || segment === 'replacement-validation') redirect('/asset-custodian/fulfillment');
  if (segment === 'disposal-review') redirect('/asset-custodian/disposal');
  if (segment === 'disposed-assets') {
    if (!child) redirect(`${basePath}/it`);
    if (!Object.hasOwn(disposedTypes, child) || (slug?.length ?? 0) > 3) notFound();
    const categoryPath = `${basePath}/${child}`;
    const assetId = slug?.[2];
    if (assetId) return <AssetDetailManager key={assetId} assetId={assetId} basePath={categoryPath} formsPath="/asset-custodian/reports" />;
    return <AssetRegistryList key={child} basePath={categoryPath} title="Disposed Assets"
      assetType={disposedTypes[child as keyof typeof disposedTypes]} archived />;
  }
  const inventory = Object.hasOwn(inventories, segment) ? inventories[segment] : undefined;
  if (inventory) {
    if (child === 'new') return <RegisterAssetForm basePath={basePath} defaultAssetType={inventory.type} />;
    if (child) return <AssetDetailManager assetId={child} basePath={basePath} formsPath="/asset-custodian/reports" />;
    return <AssetRegistryList key={segment} basePath={basePath} assetType={inventory.type} title={inventory.title} />;
  }
  if (segment === 'qr-scanner') return <QrLookup detailBasePath={assetBasePath} eyebrow={eyebrow} />;
  if (segment === 'reports') return <FormsWorkspaceContent eyebrow={eyebrow} />;
  if (!isLiveWorkflowPage(ProposedUserRole.ASSET_CUSTODIAN, segment)) notFound();
  return <WorkflowPage key={segment} role={ProposedUserRole.ASSET_CUSTODIAN} slug={segment} openId={openId} />;
}
