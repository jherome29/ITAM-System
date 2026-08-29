'use client';

import type { ReactNode } from 'react';
import { LayoutDashboard, Users, FileSearch } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const LINKS = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/users', label: 'User Management', icon: Users },
  { path: '/admin/audit-trail', label: 'Audit Trail', icon: FileSearch },
];

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <DashboardLayout links={LINKS}>{children}</DashboardLayout>;
}
