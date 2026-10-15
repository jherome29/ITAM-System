import { notFound } from 'next/navigation';
import { AdminDashboard } from './AdminDashboard';
import { AdminIdentityPages } from './AdminIdentityPages';
import { AdminPlatformPages } from './AdminPlatformPages';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { AssetRequestQueue } from '@/components/asset-requests/AssetRequestQueue';
import { MyAssignedAssets } from '@/components/assets/MyAssignedAssets';
import { RepairQueue } from '@/components/repairs/RepairQueue';

const identitySlugs = ['users', 'roles'] as const;
const platformSlugs = ['configuration', 'audit'] as const;

export function AdminWorkspace({ slug, openId }: Readonly<{ slug: string; openId?: string }>) {
  if (slug === 'dashboard') return <AdminDashboard />;
  if (slug === 'notifications') return <NotificationsContent />;
  if (slug === 'assigned-assets') return <MyAssignedAssets eyebrow="Master Administrator" canRequestReplacement={false} showRequestHistory openId={openId} />;
  // Fallback decider for custodians' own returns / incidents (segregation of
  // duties): every request is visible, only those are actionable.
  if (slug === 'returns-incidents') return <AssetRequestQueue eyebrow="Master Administrator" adminFallback openId={openId} />;
  if (slug === 'repairs') return <RepairQueue eyebrow="Master Administrator" adminFallback openId={openId} />;
  if (identitySlugs.includes(slug as (typeof identitySlugs)[number])) {
    return <AdminIdentityPages slug={slug as (typeof identitySlugs)[number]} />;
  }
  if (platformSlugs.includes(slug as (typeof platformSlugs)[number])) {
    return <AdminPlatformPages slug={slug as (typeof platformSlugs)[number]} />;
  }
  // An address with no screen behind it is not found - as for every other role.
  notFound();
}
