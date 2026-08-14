import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export interface KpiMetric {
  label: string;
  value: string;
  detail: string;
  trend: string;
  tone: 'blue' | 'amber' | 'green' | 'red';
}

export interface TrendPoint {
  label: string;
  requisitions: number;
  issued: number;
}

export interface ConditionSlice {
  label: string;
  value: number;
  color: string;
}

export interface CategoryValue {
  label: string;
  value: number;
}

export interface ActivityRow {
  id: string;
  title: string;
  owner: string;
  status: 'Pending' | 'Approved' | 'Issued' | 'Flagged' | 'Read only' | 'Draft';
  date: string;
}

export interface DashboardMockData {
  alert: string;
  kpis: KpiMetric[];
  trends: TrendPoint[];
  conditions: ConditionSlice[];
  categoryValues: CategoryValue[];
  recentRequisitions: ActivityRow[];
  awaitingApproval: ActivityRow[];
  recentMovements: ActivityRow[];
  auditActivity: ActivityRow[];
  inventoryDiscrepancies: ActivityRow[];
  lowStockAlerts: ActivityRow[];
  usefulLifeAlerts: ActivityRow[];
}

const baseData: DashboardMockData = {
  alert:
    '2 requisitions are pending your approval, and 3 assets have exceeded their prescribed useful life. Action required before end of quarter.',
  kpis: [
    { label: 'Total Assets', value: '347', detail: 'PHP 18.4M aggregate value', trend: '+12 assets this quarter', tone: 'blue' },
    { label: 'Pending Approvals', value: '7', detail: '2 high-priority items', trend: '3 exceeded 72-hour SLA', tone: 'amber' },
    { label: 'For Maintenance', value: '14', detail: '3 PMS overdue', trend: 'ICT devices need review', tone: 'green' },
    { label: 'For Disposal / IAC', value: '6', detail: 'Awaiting COA inspection', trend: '2 replacement validations open', tone: 'red' },
  ],
  trends: [
    { label: 'Jan', requisitions: 8, issued: 7 },
    { label: 'Feb', requisitions: 12, issued: 10 },
    { label: 'Mar', requisitions: 9, issued: 8 },
    { label: 'Apr', requisitions: 16, issued: 14 },
    { label: 'May', requisitions: 11, issued: 10 },
    { label: 'Jun', requisitions: 7, issued: 9 },
  ],
  conditions: [
    { label: 'Serviceable', value: 11, color: '#118345' },
    { label: 'For Repair', value: 2, color: '#c75b0a' },
    { label: 'For Disposal', value: 2, color: '#ef2c2c' },
  ],
  categoryValues: [
    { label: 'Motor Vehicles', value: 2400 },
    { label: 'ICT Equipment', value: 820 },
    { label: 'Forensic Tools', value: 810 },
    { label: 'Comms', value: 90 },
    { label: 'Network', value: 105 },
    { label: 'Furniture', value: 35 },
  ],
  recentRequisitions: [
    { id: 'REQ-2025-018', title: 'Laptop replacement for Digital Forensics', owner: 'Ana Reyes', status: 'Pending', date: 'Jun 24' },
    { id: 'REQ-2025-017', title: 'Network switch for incident room', owner: 'Mark Santos', status: 'Approved', date: 'Jun 21' },
    { id: 'REQ-2025-016', title: 'Printer toner and evidence labels', owner: 'Luis Cruz', status: 'Issued', date: 'Jun 19' },
  ],
  awaitingApproval: [
    { id: 'APR-104', title: 'Forensic workstation upgrade', owner: 'Approving Officer', status: 'Pending', date: 'Today' },
    { id: 'APR-103', title: 'Replacement mobile device kit', owner: 'Approving Officer', status: 'Pending', date: 'Yesterday' },
  ],
  recentMovements: [
    { id: 'MOV-221', title: 'Camera kit transferred to Region IV-A', owner: 'Property Unit', status: 'Issued', date: 'Jun 25' },
    { id: 'MOV-220', title: 'Returned laptop tagged for diagnosis', owner: 'ICT Custodian', status: 'Flagged', date: 'Jun 23' },
  ],
  auditActivity: [
    { id: 'AUD-884', title: 'User role preview changed', owner: 'System', status: 'Read only', date: 'Today' },
    { id: 'AUD-883', title: 'Asset registry exported', owner: 'Management', status: 'Read only', date: 'Jun 24' },
  ],
  inventoryDiscrepancies: [
    { id: 'DISC-11', title: 'Serial mismatch: Dell Latitude 5440', owner: 'ICT Inventory', status: 'Flagged', date: 'Open' },
    { id: 'DISC-10', title: 'Unlocated office chair set', owner: 'Property Inventory', status: 'Pending', date: 'Open' },
  ],
  lowStockAlerts: [
    { id: 'STK-06', title: 'Evidence barcode labels below reorder point', owner: 'Supply Inventory', status: 'Flagged', date: 'Now' },
    { id: 'STK-05', title: 'Printer toner reserve at 12%', owner: 'Supply Inventory', status: 'Pending', date: 'Now' },
  ],
  usefulLifeAlerts: [
    { id: 'UL-33', title: '3 laptops past prescribed useful life', owner: 'ICT Registry', status: 'Flagged', date: 'Quarter end' },
    { id: 'UL-32', title: '1 vehicle requires replacement validation', owner: 'Property Officer', status: 'Pending', date: 'Quarter end' },
  ],
};

const roleOverrides: Partial<Record<ProposedUserRole, Partial<DashboardMockData>>> = {
  [ProposedUserRole.EMPLOYEE]: {
    alert: 'Your laptop return is due in 3 days. Submit an incident report before requesting a replacement.',
    kpis: [
      { label: 'Assigned Assets', value: '4', detail: '3 ICT, 1 property item', trend: 'All acknowledged', tone: 'blue' },
      { label: 'Open Requisitions', value: '2', detail: '1 pending approval', trend: 'Newest request filed today', tone: 'amber' },
      { label: 'Due Returns', value: '1', detail: 'Laptop evaluation kit', trend: 'Due in 3 days', tone: 'red' },
      { label: 'Unread Notifications', value: '2', detail: 'Asset and requisition updates', trend: 'No critical alerts', tone: 'green' },
    ],
    trends: [
      { label: 'Jan', requisitions: 1, issued: 0 },
      { label: 'Feb', requisitions: 0, issued: 1 },
      { label: 'Mar', requisitions: 2, issued: 1 },
      { label: 'Apr', requisitions: 1, issued: 0 },
      { label: 'May', requisitions: 0, issued: 0 },
      { label: 'Jun', requisitions: 2, issued: 1 },
    ],
    conditions: [
      { label: 'Serviceable', value: 2, color: '#118345' },
      { label: 'For Repair', value: 1, color: '#c75b0a' },
      { label: 'For Return', value: 1, color: '#2455d6' },
      { label: 'Reported Damaged', value: 0, color: '#ef2c2c' },
    ],
    categoryValues: [
      { label: 'ICT Equipment', value: 2 },
      { label: 'Communication Devices', value: 1 },
      { label: 'Peripherals', value: 0 },
      { label: 'Other Property', value: 1 },
    ],
    recentRequisitions: [
      { id: 'REQ-2025-018', title: 'Laptop replacement', owner: 'Ana Reyes', status: 'Pending', date: 'Jun 24' },
      { id: 'REQ-2025-016', title: 'Evidence barcode labels', owner: 'Ana Reyes', status: 'Issued', date: 'Jun 19' },
      { id: 'REQ-2025-015', title: 'Evidence camera battery', owner: 'Ana Reyes', status: 'Draft', date: 'Jun 12' },
    ],
    awaitingApproval: [
      { id: 'ACT-001', title: 'Acknowledge Dell Latitude receipt', owner: 'Ana Reyes', status: 'Pending', date: 'Today' },
      { id: 'ACT-002', title: 'Attach damage photo for returned request', owner: 'Ana Reyes', status: 'Flagged', date: 'Open' },
    ],
  },
  [ProposedUserRole.MASTER_ADMIN]: {
    alert: 'Prototype role settings are frontend-only. Backend authorization remains unchanged for this phase.',
    kpis: [
      { label: 'Active Users', value: '128', detail: 'Across 9 offices', trend: '+4 this month', tone: 'blue' },
      { label: 'Role Assignments', value: '7', detail: 'Pending review', trend: 'No production RBAC changes', tone: 'amber' },
      { label: 'Reference Tables', value: '18', detail: 'Mock-managed in UI', trend: 'Ready for integration', tone: 'green' },
      { label: 'Technical Logs', value: '42', detail: 'Read-only preview', trend: 'No critical errors', tone: 'red' },
    ],
  },
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: {
    alert: 'Read-only mode is active. Create, edit, approve, issue, transfer, and disposal actions are hidden.',
  },
};

export function getDashboardMockData(role: ProposedUserRole): DashboardMockData {
  return { ...baseData, ...roleOverrides[role] };
}
