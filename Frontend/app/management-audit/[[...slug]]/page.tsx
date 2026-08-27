import { ReportsContent } from '@/components/shared/ReportsContent';
import { FormsArchiveContent } from '@/components/shared/FormsArchiveContent';
import { ManagementAuditDashboard } from '@/components/management-audit/ManagementAuditDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ManagementAuditPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <ManagementAuditDashboard />;
  if (segment === 'asset-reports') return <ReportsContent reportTypes={['ASSET_MASTER_LIST', 'ASSET_ISSUANCE', 'ASSET_RETURN']} pageTitle="Asset Reports" panelTitle="Asset Reports" />;
  if (segment === 'requisition-reports') return <ReportsContent reportTypes={['REQUISITION_HISTORY']} pageTitle="Requisition Reports" panelTitle="Requisition Reports" />;
  if (segment === 'maintenance-disposal') return <ReportsContent reportTypes={['DISPOSAL']} pageTitle="Maintenance & Disposal Reports" panelTitle="Disposal Documentation" />;
  if (segment === 'physical-count') return <ReportsContent reportTypes={['PHYSICAL_COUNT']} pageTitle="Physical Count Reports" panelTitle="Physical Count Summary" />;
  if (segment === 'forms') return <FormsArchiveContent />;
  return <WorkflowPage role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} slug={segment} />;
}

