import { MyAssignedAssets } from '@/components/assets/MyAssignedAssets';
import { ApprovingOfficerDashboard } from '@/components/approving-officer/ApprovingOfficerDashboard';
import { ApprovalHistory } from '@/components/requisitions/ApprovalHistory';
import { notFound } from 'next/navigation';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { isLiveWorkflowPage } from '@/lib/workflow/live-pages';

export default async function ApprovingOfficerPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ slug?: string[] }>; searchParams: Promise<{ open?: string | string[] }> }>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <ApprovingOfficerDashboard />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assigned-assets') return <MyAssignedAssets eyebrow="Approving Officer" canRequestReplacement showRequestHistory openId={typeof open === 'string' ? open : undefined} />;
  if (segment === 'approval-history') return <ApprovalHistory eyebrow="Approving Officer" />;
  // Only pages wired to real records may reach WorkflowPage; anything else is sample
  // data, so it is not found (see lib/workflow/live-pages.ts).
  if (!isLiveWorkflowPage(ProposedUserRole.APPROVING_OFFICER, segment)) notFound();
  return <WorkflowPage role={ProposedUserRole.APPROVING_OFFICER} slug={segment} openId={typeof open === 'string' ? open : undefined} />;
}

