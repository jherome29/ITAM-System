import { notFound, redirect } from 'next/navigation';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { QrLookup } from '@/components/assets/QrLookup';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { ItAssetCustodianDashboard } from '@/components/it-asset-custodian/ItAssetCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { FormsWorkspaceContent } from '@/components/shared/FormsWorkspaceContent';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { roleNavigation } from '@/lib/roles/role-navigation';

const inventories: Record<string, { type?: string; title: string }> = {
  'it-inventory': { type: 'ICT', title: 'IT Inventory' },
  'fixed-assets': { type: 'Fixed', title: 'Fixed Asset Inventory' },
  supplies: { type: 'Supplies', title: 'Supplies Inventory' },
  assets: { title: 'All Assets' },
};
const disposedTypes = { it: 'ICT', fixed: 'Fixed', supplies: 'Supplies' } as const;

export default async function AssetCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  const basePath = '/asset-custodian/' + segment;
  if (segment === 'dashboard') return <ItAssetCustodianDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
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
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/asset-custodian/assets" />;
  if (segment === 'reports') return <FormsWorkspaceContent />;
  if (!roleNavigation[ProposedUserRole.ASSET_CUSTODIAN].some(item => item.href === basePath)) notFound();
  return <WorkflowPage key={segment} role={ProposedUserRole.ASSET_CUSTODIAN} slug={segment} />;
}
