import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

export default async function MasterAdminPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ slug?: string[] }>; searchParams: Promise<{ open?: string | string[] }> }>) {
  const { slug } = await params;
  const { open } = await searchParams;
  const segment = slug?.[0] ?? 'dashboard';
  return <AdminWorkspace slug={segment} openId={typeof open === 'string' ? open : undefined} />;
}
