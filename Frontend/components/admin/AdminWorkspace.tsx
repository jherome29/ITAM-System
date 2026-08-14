import { AdminDashboard } from './AdminDashboard';
import { AdminGovernancePages } from './AdminGovernancePages';
import { AdminIdentityPages } from './AdminIdentityPages';
import { AdminPlatformPages } from './AdminPlatformPages';

const identitySlugs = ['users', 'roles', 'access-reviews', 'organizational-units'] as const;
const governanceSlugs = ['approval-configuration', 'custodian-assignments'] as const;
const platformSlugs = ['reference-data', 'configuration', 'technical-logs', 'security', 'audit'] as const;

export function AdminWorkspace({ slug }: { slug: string }) {
  if (slug === 'dashboard') return <AdminDashboard />;
  if (identitySlugs.includes(slug as (typeof identitySlugs)[number])) {
    return <AdminIdentityPages slug={slug as (typeof identitySlugs)[number]} />;
  }
  if (governanceSlugs.includes(slug as (typeof governanceSlugs)[number])) {
    return <AdminGovernancePages slug={slug as (typeof governanceSlugs)[number]} />;
  }
  if (platformSlugs.includes(slug as (typeof platformSlugs)[number])) {
    return <AdminPlatformPages slug={slug as (typeof platformSlugs)[number]} />;
  }
  return <AdminDashboard />;
}
