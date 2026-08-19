'use client';

import type { ReactNode } from 'react';
import { Home, ClipboardList, History, Bell } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const LINKS = [
  { path: '/supervisor/dashboard', label: 'Dashboard', icon: Home },
  { path: '/supervisor/approvals', label: 'Pending Approvals', icon: ClipboardList },
  { path: '/supervisor/history', label: 'Approval History', icon: History },
  { path: '/supervisor/notifications', label: 'Notifications', icon: Bell },
];

export default function SupervisorLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <DashboardLayout links={LINKS}>{children}</DashboardLayout>;
}
