import { MyAssignedAssets } from '@/components/assets/MyAssignedAssets';
import { ReportsContent } from '@/components/shared/ReportsContent';
import { FormsWorkspaceContent } from '@/components/shared/FormsWorkspaceContent';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ManagementAuditDashboard } from '@/components/management-audit/ManagementAuditDashboard';
import { AuditLogPage } from '@/components/admin/AdminPlatformPages';
import { notFound } from 'next/navigation';
import { normalizeWorkflowSlug } from '@/lib/workflow/live-pages';
import { ProposedUserRole, workspaceLabels } from '@/lib/roles/proposed-roles';

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
  if (segment === 'asset-reports') return <ReportsContent eyebrow="Management" reportTypes={['ASSET_MASTER_LIST', 'ASSET_ISSUANCE', 'ASSET_RETURN']} pageTitle="Asset Reports" panelTitle="Asset Reports" />;
  if (segment === 'requisition-reports') return <ReportsContent eyebrow="Management" reportTypes={['REQUISITION_HISTORY']} pageTitle="Requisition Reports" panelTitle="Requisition Reports" />;
  if (segment === 'maintenance-disposal') return <ReportsContent eyebrow="Management" reportTypes={['REPAIR_HISTORY', 'DISPOSAL']} pageTitle="Maintenance & Disposal Reports" panelTitle="Repair & Disposal Reports" />;
  if (segment === 'physical-count') return <ReportsContent eyebrow="Management" reportTypes={['PHYSICAL_COUNT']} pageTitle="Physical Count Reports" panelTitle="Physical Count Summary" />;
  if (segment === 'forms') return <FormsWorkspaceContent eyebrow="Management" canGenerate={false} />;
  // Read-only evidence: the same append-only audit viewer the Master Admin uses.
  if (normalizeWorkflowSlug(segment) === 'audit') return <AuditLogPage eyebrow={workspaceLabels[ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]} />;
  notFound();
}

