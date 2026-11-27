import {
  Archive,
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileClock,
  FileText,
  Gauge,
  History,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Package,
  PackageCheck,
  ScanBarcode,
  RefreshCcw,
  ScanLine,
  Settings,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ProposedUserRole } from './proposed-roles';

export interface RoleNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: string;
  readOnly?: boolean;
}

export const roleNavigation: Record<ProposedUserRole, RoleNavItem[]> = {
  [ProposedUserRole.EMPLOYEE]: [
    { section: 'Overview', label: 'My Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
    { section: 'Request & Track', label: 'Asset Catalogue', href: '/employee/catalogue', icon: Package },
    { label: 'My Requisitions', href: '/employee/requisitions', icon: ClipboardList },
    { section: 'My Accountability', label: 'My Assigned Assets', href: '/employee/assigned-assets', icon: PackageCheck },
    { label: 'Returns & Incidents', href: '/employee/returns-incidents', icon: RefreshCcw },
    { section: 'Updates', label: 'Notifications', href: '/employee/notifications', icon: Bell },
  ],
  [ProposedUserRole.APPROVING_OFFICER]: [
    { section: 'Approvals', label: 'Approval Dashboard', href: '/approving-officer/dashboard', icon: LayoutDashboard },
    { label: 'Approval Queue', href: '/approving-officer/approvals', icon: ClipboardCheck },
    { label: 'Approval History', href: '/approving-officer/approval-history', icon: History },
    { section: 'My Requests', label: 'My Requisitions', href: '/approving-officer/requisitions', icon: ClipboardList },
    { label: 'My Assigned Assets', href: '/approving-officer/assigned-assets', icon: PackageCheck },
    { label: 'Notifications', href: '/approving-officer/notifications', icon: Bell },
  ],
  [ProposedUserRole.ASSET_CUSTODIAN]: [
    { section: 'Overview', label: 'Dashboard', href: '/asset-custodian/dashboard', icon: LayoutDashboard },
    { section: 'Inventory', label: 'IT Inventory', href: '/asset-custodian/it-inventory', icon: Boxes },
    { label: 'Fixed Asset Inventory', href: '/asset-custodian/fixed-assets', icon: Landmark },
    { label: 'Supplies Inventory', href: '/asset-custodian/supplies', icon: Package },
    { label: 'Disposed Assets', href: '/asset-custodian/disposed-assets', icon: Archive },
    { section: 'Operations', label: 'Requisition Fulfillment', href: '/asset-custodian/fulfillment', icon: ListChecks },
    { label: 'Custody & Issuance', href: '/asset-custodian/custody', icon: PackageCheck },
    { label: 'Barcode Scanner', href: '/asset-custodian/qr-scanner', icon: ScanBarcode },
    { label: 'Maintenance & Repair', href: '/asset-custodian/maintenance', icon: Wrench },
    { label: 'Physical Inventory', href: '/asset-custodian/physical-inventory', icon: ScanLine },
    { label: 'Disposal Recommendations', href: '/asset-custodian/disposal', icon: Archive },
    { section: 'Reports & Updates', label: 'Reports & Forms', href: '/asset-custodian/reports', icon: FileBarChart },
    { label: 'Management Reports', href: '/asset-custodian/management-reports', icon: FileText },
    { section: 'My Requests', label: 'My Requisitions', href: '/asset-custodian/requisitions', icon: ClipboardList },
    { label: 'My Assigned Assets', href: '/asset-custodian/assigned-assets', icon: PackageCheck },
    { label: 'Notifications', href: '/asset-custodian/notifications', icon: Bell },
  ],
  [ProposedUserRole.MASTER_ADMIN]: [
    { section: 'Overview', label: 'Admin Dashboard', href: '/master-admin/dashboard', icon: LayoutDashboard },
    { section: 'Identity & Access', label: 'Users & Accounts', href: '/master-admin/users', icon: Users },
    { label: 'Roles & Permissions', href: '/master-admin/roles', icon: KeyRound },
    { section: 'Platform', label: 'System Settings', href: '/master-admin/configuration', icon: Settings },
    { section: 'Security & Audit', label: 'Audit Log', href: '/master-admin/audit', icon: FileClock, readOnly: true },
    { section: 'Escalations', label: 'Returns & Incidents', href: '/master-admin/returns-incidents', icon: RefreshCcw },
    { label: 'Repairs', href: '/master-admin/repairs', icon: Wrench },
    { label: 'Requisition Fulfillment', href: '/master-admin/fulfillment', icon: ListChecks },
    { section: 'My Accountability', label: 'My Assigned Assets', href: '/master-admin/assigned-assets', icon: PackageCheck },
    { section: 'Updates', label: 'Notifications', href: '/master-admin/notifications', icon: Bell },
  ],
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: [
    { section: 'Read Only', label: 'Executive Dashboard', href: '/management-audit/dashboard', icon: Gauge, readOnly: true },
    { label: 'Asset Reports', href: '/management-audit/asset-reports', icon: FileBarChart, readOnly: true },
    { label: 'Requisition Reports', href: '/management-audit/requisition-reports', icon: ClipboardList, readOnly: true },
    { label: 'Maintenance & Disposal Reports', href: '/management-audit/maintenance-disposal', icon: Wrench, readOnly: true },
    { label: 'Physical Count Reports', href: '/management-audit/physical-count', icon: ScanLine, readOnly: true },
    { label: 'Audit Log', href: '/management-audit/audit', icon: FileClock, readOnly: true },
    { label: 'Forms Archive', href: '/management-audit/forms', icon: Archive, readOnly: true },
    { section: 'My Accountability', label: 'My Assigned Assets', href: '/management-audit/assigned-assets', icon: PackageCheck },
    { section: 'Updates', label: 'Notifications', href: '/management-audit/notifications', icon: Bell, readOnly: true },
  ],
};
