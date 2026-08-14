import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

export default async function MasterAdminPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  return <AdminWorkspace slug={segment} />;
}
