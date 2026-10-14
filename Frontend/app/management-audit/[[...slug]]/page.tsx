import { MyAssignedAssets } from '@/components/assets/MyAssignedAssets';
import { ReportsContent } from '@/components/shared/ReportsContent';
import { FormsArchiveContent } from '@/components/shared/FormsArchiveContent';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ManagementAuditDashboard } from '@/components/management-audit/ManagementAuditDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ManagementAuditPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ slug?: string[] }>; searchParams: Promise<{ open?: string | string[] }> }>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <ManagementAuditDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assigned-assets') return <MyAssignedAssets eyebrow="Management" canRequestReplacement={false} showRequestHistory openId={typeof open === 'string' ? open : undefined} />;
  if (segment === 'asset-reports') return <ReportsContent reportTypes={['ASSET_MASTER_LIST', 'ASSET_ISSUANCE', 'ASSET_RETURN']} pageTitle="Asset Reports" panelTitle="Asset Reports" />;
  if (segment === 'requisition-reports') return <ReportsContent reportTypes={['REQUISITION_HISTORY']} pageTitle="Requisition Reports" panelTitle="Requisition Reports" />;
  if (segment === 'maintenance-disposal') return <ReportsContent reportTypes={['REPAIR_HISTORY', 'DISPOSAL']} pageTitle="Maintenance & Disposal Reports" panelTitle="Repair & Disposal Reports" />;
  if (segment === 'physical-count') return <ReportsContent reportTypes={['PHYSICAL_COUNT']} pageTitle="Physical Count Reports" panelTitle="Physical Count Summary" />;
  if (segment === 'forms') return <FormsArchiveContent />;
  return <WorkflowPage role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} slug={segment} />;
}

