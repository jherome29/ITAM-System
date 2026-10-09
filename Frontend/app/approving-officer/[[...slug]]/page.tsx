import { ApprovingOfficerDashboard } from '@/components/approving-officer/ApprovingOfficerDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ApprovingOfficerPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ slug?: string[] }>; searchParams: Promise<{ open?: string | string[] }> }>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <ApprovingOfficerDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  return <WorkflowPage role={ProposedUserRole.APPROVING_OFFICER} slug={segment} openId={typeof open === 'string' ? open : undefined} />;
}

