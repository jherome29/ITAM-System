import { PropertyOfficerDashboard } from '@/components/property-officer/PropertyOfficerDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyOfficerPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <PropertyOfficerDashboard />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_OFFICER} slug={segment} />;
}
