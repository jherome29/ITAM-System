import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyOfficerPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.PROPERTY_OFFICER} />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_OFFICER} slug={segment} />;
}

