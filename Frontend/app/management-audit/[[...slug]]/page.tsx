import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ManagementAuditPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} />;
  return <WorkflowPage role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} slug={segment} />;
}

