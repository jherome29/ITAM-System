import { AdminDashboard } from './AdminDashboard';
import { AdminIdentityPages } from './AdminIdentityPages';
import { AdminPlatformPages } from './AdminPlatformPages';
import { NotificationsContent } from '@/components/shared/NotificationsContent';

const identitySlugs = ['users', 'roles'] as const;
const platformSlugs = ['configuration', 'security', 'audit'] as const;

export function AdminWorkspace({ slug }: Readonly<{ slug: string }>) {
  if (slug === 'dashboard') return <AdminDashboard />;
  if (slug === 'notifications') return <NotificationsContent />;
  if (identitySlugs.includes(slug as (typeof identitySlugs)[number])) {
    return <AdminIdentityPages slug={slug as (typeof identitySlugs)[number]} />;
  }
  if (platformSlugs.includes(slug as (typeof platformSlugs)[number])) {
    return <AdminPlatformPages slug={slug as (typeof platformSlugs)[number]} />;
  }
  return <AdminDashboard />;
}
