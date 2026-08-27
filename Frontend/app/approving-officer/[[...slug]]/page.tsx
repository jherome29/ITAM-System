import { ApprovingOfficerDashboard } from '@/components/approving-officer/ApprovingOfficerDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ApprovingOfficerPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <ApprovingOfficerDashboard />;
  return <WorkflowPage role={ProposedUserRole.APPROVING_OFFICER} slug={segment} />;
}

