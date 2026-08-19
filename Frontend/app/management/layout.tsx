'use client';

import type { ReactNode } from 'react';
import { LayoutDashboard, BarChart2, FileSearch, Bell } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const LINKS = [
  { path: '/management/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/management/reports', label: 'Reports', icon: BarChart2 },
  { path: '/management/audit-trail', label: 'Audit Trail', icon: FileSearch },
  { path: '/management/notifications', label: 'Notifications', icon: Bell },
];

export default function ManagementLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <DashboardLayout links={LINKS}>{children}</DashboardLayout>;
}
