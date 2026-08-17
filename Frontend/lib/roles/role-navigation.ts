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
  QrCode,
  RefreshCcw,
  Repeat2,
  ScanLine,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
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
    { label: 'My Requisitions', href: '/approving-officer/requisitions', icon: ClipboardList },
    { label: 'Notifications', href: '/approving-officer/notifications', icon: Bell },
  ],
  [ProposedUserRole.IT_ASSET_CUSTODIAN]: [
    { section: 'ICT Lifecycle', label: 'ICT Dashboard', href: '/it-asset-custodian/dashboard', icon: LayoutDashboard },
    { label: 'ICT Asset Registry', href: '/it-asset-custodian/assets', icon: Boxes },
    { label: 'ICT Requisition Fulfillment', href: '/it-asset-custodian/fulfillment', icon: ListChecks },
    { label: 'Custody & Issuance', href: '/it-asset-custodian/custody', icon: PackageCheck },
    { label: 'QR Scanner', href: '/it-asset-custodian/qr-scanner', icon: QrCode },
    { label: 'Maintenance & Repair', href: '/it-asset-custodian/maintenance', icon: Wrench },
    { label: 'ICT Physical Inventory', href: '/it-asset-custodian/physical-inventory', icon: ScanLine },
    { label: 'ICT Disposal Recommendations', href: '/it-asset-custodian/disposal', icon: Archive },
    { label: 'ICT Reports & Forms', href: '/it-asset-custodian/reports', icon: FileBarChart },
    { label: 'Notifications', href: '/it-asset-custodian/notifications', icon: Bell },
  ],
  [ProposedUserRole.PROPERTY_CUSTODIAN]: [
    { section: 'Property Lifecycle', label: 'Property Dashboard', href: '/property-custodian/dashboard', icon: LayoutDashboard },
    { label: 'Fixed Asset Registry', href: '/property-custodian/fixed-assets', icon: Landmark },
    { label: 'Supply Inventory', href: '/property-custodian/supplies', icon: Boxes },
    { label: 'Property Requisition Fulfillment', href: '/property-custodian/fulfillment', icon: ListChecks },
    { label: 'Custody & Issuance', href: '/property-custodian/custody', icon: PackageCheck },
    { label: 'QR Scanner', href: '/property-custodian/qr-scanner', icon: QrCode },
    { label: 'Physical Inventory', href: '/property-custodian/physical-inventory', icon: ScanLine },
    { label: 'Property Disposal Recommendations', href: '/property-custodian/disposal', icon: Archive },
    { label: 'Property Reports & Forms', href: '/property-custodian/reports', icon: FileBarChart },
    { label: 'Notifications', href: '/property-custodian/notifications', icon: Bell },
  ],
  [ProposedUserRole.PROPERTY_OFFICER]: [
    { section: 'Governance', label: 'Consolidated Dashboard', href: '/property-officer/dashboard', icon: Gauge },
    { label: 'Consolidated Asset Registry', href: '/property-officer/assets', icon: Boxes },
    { label: 'Inventory Corrections', href: '/property-officer/corrections', icon: SlidersHorizontal },
    { label: 'Reconciliation', href: '/property-officer/reconciliation', icon: Repeat2 },
    { label: 'Replacement Validation', href: '/property-officer/replacements', icon: ShieldCheck },
    { label: 'Disposal Review', href: '/property-officer/disposal', icon: Archive },
    { label: 'Reports & Forms', href: '/property-officer/reports', icon: FileText },
    { label: 'Audit History', href: '/property-officer/audit', icon: FileClock },
  ],
  [ProposedUserRole.MASTER_ADMIN]: [
    { section: 'Overview', label: 'Admin Dashboard', href: '/master-admin/dashboard', icon: LayoutDashboard },
    { section: 'Identity & Access', label: 'Users & Accounts', href: '/master-admin/users', icon: Users },
    { label: 'Roles & Permissions', href: '/master-admin/roles', icon: KeyRound },
    { label: 'Access Reviews', href: '/master-admin/access-reviews', icon: ListChecks },
    { label: 'Organization Structure', href: '/master-admin/organizational-units', icon: Landmark },
    { section: 'Workflow Governance', label: 'Approval Workflows', href: '/master-admin/approval-configuration', icon: ClipboardCheck },
    { label: 'Custodian Coverage', href: '/master-admin/custodian-assignments', icon: PackageCheck },
    { section: 'Data Management', label: 'Master Data', href: '/master-admin/reference-data', icon: FileText },
    { section: 'Platform', label: 'System Settings', href: '/master-admin/configuration', icon: Settings },
    { label: 'System Health & Jobs', href: '/master-admin/technical-logs', icon: RefreshCcw },
    { section: 'Security & Audit', label: 'Security Policies', href: '/master-admin/security', icon: ShieldCheck },
    { label: 'Audit Log', href: '/master-admin/audit', icon: FileClock, readOnly: true },
  ],
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: [
    { section: 'Read Only', label: 'Executive Dashboard', href: '/management-audit/dashboard', icon: Gauge, readOnly: true },
    { label: 'Asset Reports', href: '/management-audit/asset-reports', icon: FileBarChart, readOnly: true },
    { label: 'Requisition Reports', href: '/management-audit/requisition-reports', icon: ClipboardList, readOnly: true },
    { label: 'Maintenance & Disposal Reports', href: '/management-audit/maintenance-disposal', icon: Wrench, readOnly: true },
    { label: 'Physical Count Reports', href: '/management-audit/physical-count', icon: ScanLine, readOnly: true },
    { label: 'Audit Log', href: '/management-audit/audit', icon: FileClock, readOnly: true },
    { label: 'Forms Archive', href: '/management-audit/forms', icon: Archive, readOnly: true },
  ],
};
