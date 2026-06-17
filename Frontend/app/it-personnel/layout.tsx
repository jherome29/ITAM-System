'use client';

import type { ReactNode } from 'react';
import { LayoutDashboard, Package, PlusCircle, QrCode, ClipboardList, FileSpreadsheet, BarChart2, Bell } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const LINKS = [
  { path: '/it-personnel/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/it-personnel/assets', label: 'Asset Inventory', icon: Package },
  { path: '/it-personnel/assets/new', label: 'Add New Asset', icon: PlusCircle },
  { path: '/it-personnel/qr-scan', label: 'Scan QR Code', icon: QrCode },
  { path: '/it-personnel/requisitions', label: 'Requisitions', icon: ClipboardList },
  { path: '/it-personnel/forms', label: 'Forms', icon: FileSpreadsheet },
  { path: '/it-personnel/reports', label: 'Reports', icon: BarChart2 },
  { path: '/it-personnel/notifications', label: 'Notifications', icon: Bell },
];

export default function ItPersonnelLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout links={LINKS}>{children}</DashboardLayout>;
}
