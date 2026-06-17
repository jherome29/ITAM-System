'use client';

import type { ReactNode } from 'react';
import { Home, FileText, List, Bell, Package } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const LINKS = [
  { path: '/employee/dashboard', label: 'Dashboard', icon: Home },
  { path: '/employee/requisitions/new', label: 'Submit Requisition', icon: FileText },
  { path: '/employee/requisitions', label: 'My Requisitions', icon: List },
  { path: '/employee/catalogue', label: 'Asset Catalogue', icon: Package },
  { path: '/employee/notifications', label: 'Notifications', icon: Bell },
];

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout links={LINKS}>{children}</DashboardLayout>;
}
