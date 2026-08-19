export type AdminTone = 'blue' | 'green' | 'amber' | 'red' | 'slate';

export interface AdminUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  office: string;
  roles: string[];
  accountType: 'Employee' | 'Privileged' | 'Service';
  mfa: 'Enabled' | 'Not enrolled';
  lastLogin: string;
  status: 'Active' | 'Locked' | 'Dormant' | 'Scheduled deactivation';
}

export const adminUsers: AdminUser[] = [
  { id: 'USR-001', employeeId: 'CICC-0001', name: 'Ricardo Torres', email: 'ricardo.torres@cicc.gov.ph', office: 'System Administration', roles: ['Master Administrator'], accountType: 'Privileged', mfa: 'Enabled', lastLogin: 'Today, 8:42 PM', status: 'Active' },
  { id: 'USR-002', employeeId: 'CICC-0042', name: 'Ana Reyes', email: 'ana.reyes@cicc.gov.ph', office: 'Digital Forensics', roles: ['Employee'], accountType: 'Employee', mfa: 'Enabled', lastLogin: 'Today, 3:18 PM', status: 'Active' },
  { id: 'USR-003', employeeId: 'CICC-0026', name: 'Mila Santos', email: 'mila.santos@cicc.gov.ph', office: 'Administrative Service', roles: ['Approving Officer'], accountType: 'Privileged', mfa: 'Enabled', lastLogin: 'Yesterday, 4:02 PM', status: 'Active' },
  { id: 'USR-004', employeeId: 'CICC-0018', name: 'Paolo Cruz', email: 'paolo.cruz@cicc.gov.ph', office: 'ICT Unit', roles: ['IT Asset Custodian'], accountType: 'Privileged', mfa: 'Enabled', lastLogin: 'Today, 5:31 PM', status: 'Active' },
  { id: 'USR-005', employeeId: 'CICC-0031', name: 'Leah Garcia', email: 'leah.garcia@cicc.gov.ph', office: 'Property Unit', roles: ['Property Custodian'], accountType: 'Privileged', mfa: 'Not enrolled', lastLogin: 'Jul 3, 2026', status: 'Active' },
  { id: 'USR-006', employeeId: 'CICC-0064', name: 'Mark Santos', email: 'mark.santos@cicc.gov.ph', office: 'Operations Division', roles: ['Employee'], accountType: 'Employee', mfa: 'Not enrolled', lastLogin: 'Jun 11, 2026', status: 'Dormant' },
  { id: 'USR-007', employeeId: 'CICC-0090', name: 'Elena Dizon', email: 'elena.dizon@cicc.gov.ph', office: 'Management Office', roles: ['Management & Audit Viewer'], accountType: 'Privileged', mfa: 'Enabled', lastLogin: 'Jul 8, 2026', status: 'Locked' },
];

export interface AdminRole {
  id: string;
  name: string;
  scope: string;
  users: number;
  permissions: number;
  privilege: 'Standard' | 'Elevated' | 'Administrative' | 'Read only';
  owner: string;
  lastReviewed: string;
  reviewStatus: 'Current' | 'Review due' | 'Overdue';
}

export const adminRoles: AdminRole[] = [
  { id: 'ROL-001', name: 'Employee', scope: 'Own records', users: 104, permissions: 5, privilege: 'Standard', owner: 'System Administration', lastReviewed: 'Jun 14, 2026', reviewStatus: 'Current' },
  { id: 'ROL-002', name: 'Approving Officer', scope: 'Assigned organizational unit', users: 9, permissions: 6, privilege: 'Elevated', owner: 'Administrative Service', lastReviewed: 'Apr 4, 2026', reviewStatus: 'Review due' },
  { id: 'ROL-003', name: 'IT Asset Custodian', scope: 'ICT asset family', users: 4, permissions: 12, privilege: 'Elevated', owner: 'ICT Unit', lastReviewed: 'Jun 20, 2026', reviewStatus: 'Current' },
  { id: 'ROL-004', name: 'Property Custodian', scope: 'Property asset family', users: 4, permissions: 11, privilege: 'Elevated', owner: 'Property Unit', lastReviewed: 'Jun 20, 2026', reviewStatus: 'Current' },
  { id: 'ROL-005', name: 'Property Officer', scope: 'Agency-wide property', users: 2, permissions: 9, privilege: 'Elevated', owner: 'Administrative Service', lastReviewed: 'Mar 1, 2026', reviewStatus: 'Overdue' },
  { id: 'ROL-006', name: 'Master Administrator', scope: 'Platform administration', users: 2, permissions: 8, privilege: 'Administrative', owner: 'CICC IT Security', lastReviewed: 'Jul 1, 2026', reviewStatus: 'Current' },
  { id: 'ROL-007', name: 'Management & Audit Viewer', scope: 'Agency-wide read only', users: 3, permissions: 6, privilege: 'Read only', owner: 'Management Office', lastReviewed: 'May 12, 2026', reviewStatus: 'Current' },
];

export const permissionGroups = [
  { group: 'Requisitions', employee: 'Create own', approver: 'Review assigned', ict: 'Fulfill ICT', property: 'Fulfill property', admin: 'Oversight' },
  { group: 'Asset registry', employee: 'View catalogue', approver: 'None', ict: 'Manage ICT', property: 'Manage property', admin: 'View all' },
  { group: 'Custody', employee: 'Own assets', approver: 'None', ict: 'Issue ICT', property: 'Issue property', admin: 'View all' },
  { group: 'Reports', employee: 'Own records', approver: 'Approval history', ict: 'Operational', property: 'Operational', admin: 'All reports' },
  { group: 'Administration', employee: 'None', approver: 'None', ict: 'None', property: 'None', admin: 'Manage' },
];

export const accessReviews = [
  { id: 'REV-2026-Q3-01', name: 'Quarterly privileged access review', owner: 'Ricardo Torres', scope: '24 privileged accounts', due: 'Jul 15, 2026', progress: 71, status: 'In progress' },
  { id: 'REV-2026-Q3-02', name: 'Dormant account certification', owner: 'Mila Santos', scope: '8 dormant accounts', due: 'Jul 12, 2026', progress: 38, status: 'At risk' },
  { id: 'REV-2026-H1-03', name: 'Custodian role recertification', owner: 'Paolo Cruz', scope: '8 custodian assignments', due: 'Jun 30, 2026', progress: 100, status: 'Completed' },
];

export const organizationUnits = [
  { id: 'OU-001', code: 'CICC', name: 'Cybercrime Investigation and Coordinating Center', type: 'Agency', parent: '-', head: 'Executive Director', users: 128, custodian: 'Agency-wide coverage', status: 'Active' },
  { id: 'OU-010', code: 'DFD', name: 'Digital Forensics Division', type: 'Division', parent: 'CICC', head: 'Ana Reyes', users: 24, custodian: 'Paolo Cruz', status: 'Active' },
  { id: 'OU-011', code: 'DFD-EP', name: 'Evidence Processing Section', type: 'Section', parent: 'Digital Forensics Division', head: 'Luis Cruz', users: 9, custodian: 'Paolo Cruz', status: 'Active' },
  { id: 'OU-020', code: 'AS', name: 'Administrative Service', type: 'Service', parent: 'CICC', head: 'Mila Santos', users: 31, custodian: 'Leah Garcia', status: 'Active' },
  { id: 'OU-021', code: 'AS-ICT', name: 'ICT Unit', type: 'Unit', parent: 'Administrative Service', head: 'Paolo Cruz', users: 8, custodian: 'Paolo Cruz', status: 'Active' },
  { id: 'OU-022', code: 'AS-PROP', name: 'Property Unit', type: 'Unit', parent: 'Administrative Service', head: 'Leah Garcia', users: 7, custodian: 'Leah Garcia', status: 'Active' },
];

export const approvalWorkflows = [
  { id: 'WF-001', name: 'Standard asset requisition', requestType: 'New asset', scope: 'All offices', trigger: 'Any value', stages: 2, sla: '24 hours', version: 'v3', status: 'Published' },
  { id: 'WF-002', name: 'Replacement validation', requestType: 'Replacement', scope: 'ICT and PPE', trigger: 'Useful-life or incident', stages: 3, sla: '48 hours', version: 'v2', status: 'Published' },
  { id: 'WF-003', name: 'Urgent operational request', requestType: 'New asset', scope: 'Operations', trigger: 'High priority', stages: 2, sla: '8 hours', version: 'v1', status: 'Draft' },
  { id: 'WF-004', name: 'Supply replenishment', requestType: 'Supply', scope: 'All offices', trigger: 'Below reorder point', stages: 1, sla: '24 hours', version: 'v4', status: 'Published' },
];

export const custodianCoverage = [
  { id: 'COV-001', custodian: 'Paolo Cruz', assignment: 'Primary', office: 'All CICC offices', location: 'Central Facility', assetFamily: 'ICT equipment', start: 'Jan 1, 2026', end: '-', coverage: 'Covered' },
  { id: 'COV-002', custodian: 'Leah Garcia', assignment: 'Primary', office: 'All CICC offices', location: 'Central Facility', assetFamily: 'PPE and SEP', start: 'Jan 1, 2026', end: '-', coverage: 'Covered' },
  { id: 'COV-003', custodian: 'Ramon Lim', assignment: 'Alternate', office: 'Administrative Service', location: 'Stockroom A', assetFamily: 'Supplies', start: 'Mar 1, 2026', end: 'Dec 31, 2026', coverage: 'Covered' },
  { id: 'COV-004', custodian: 'Unassigned', assignment: 'Primary', office: 'Regional Coordination Desk', location: 'Region IV-A', assetFamily: 'ICT equipment', start: '-', end: '-', coverage: 'Gap' },
];

export const masterDataGroups = [
  { id: 'REF-001', name: 'Asset categories', records: 18, usedBy: 'Asset registration, reports', lastChanged: 'Jul 5, 2026', owner: 'Property Unit', status: 'Healthy' },
  { id: 'REF-002', name: 'Asset conditions', records: 6, usedBy: 'Lifecycle, physical count', lastChanged: 'Jun 18, 2026', owner: 'ICT Unit', status: 'Protected' },
  { id: 'REF-003', name: 'Locations', records: 27, usedBy: 'Custody, transfers', lastChanged: 'Jul 8, 2026', owner: 'Administrative Service', status: 'Review due' },
  { id: 'REF-004', name: 'Useful-life rules', records: 12, usedBy: 'Replacement validation', lastChanged: 'May 22, 2026', owner: 'Property Officer', status: 'Healthy' },
  { id: 'REF-005', name: 'Form types', records: 18, usedBy: 'COA form generation', lastChanged: 'Apr 3, 2026', owner: 'Property Unit', status: 'Protected' },
  { id: 'REF-006', name: 'Units of measure', records: 9, usedBy: 'Supplies, reports', lastChanged: 'Mar 14, 2026', owner: 'Property Unit', status: 'Healthy' },
];

export const systemEvents = [
  { id: 'EVT-00941', timestamp: 'Today, 8:48:28 PM', severity: 'Error', service: 'Database', event: 'Connection retry failed', correlationId: 'corr-db-8021', duration: '30.2 s', status: 'Open' },
  { id: 'EVT-00940', timestamp: 'Today, 8:48:14 PM', severity: 'Info', service: 'API', event: 'Application startup initiated', correlationId: 'corr-api-8019', duration: '4.4 s', status: 'Completed' },
  { id: 'EVT-00939', timestamp: 'Today, 6:00:02 PM', severity: 'Warning', service: 'Notifications', event: 'SLA notification job completed with warnings', correlationId: 'corr-job-7812', duration: '1.8 s', status: 'Review' },
  { id: 'EVT-00938', timestamp: 'Today, 3:30:00 PM', severity: 'Info', service: 'Reports', event: 'Report cleanup job completed', correlationId: 'corr-job-7701', duration: '0.9 s', status: 'Completed' },
];

export const scheduledJobs = [
  { id: 'JOB-001', name: 'SLA breach monitor', schedule: 'Every 15 minutes', lastRun: 'Today, 8:45 PM', nextRun: 'Today, 9:00 PM', duration: '1.8 s', result: 'Warning' },
  { id: 'JOB-002', name: 'Useful-life alert generation', schedule: 'Daily, 1:00 AM', lastRun: 'Today, 1:00 AM', nextRun: 'Tomorrow, 1:00 AM', duration: '6.2 s', result: 'Success' },
  { id: 'JOB-003', name: 'Notification retention cleanup', schedule: 'Weekly, Sunday', lastRun: 'Jul 5, 2026', nextRun: 'Jul 12, 2026', duration: '2.4 s', result: 'Success' },
];

export const auditRecords = [
  { id: 'AUD-00884', timestamp: 'Today, 8:42:16 PM', actor: 'Ricardo Torres', role: 'Master Administrator', action: 'USER_LOGIN', record: 'USR-001', source: '10.10.2.14', outcome: 'Success' },
  { id: 'AUD-00883', timestamp: 'Today, 5:31:04 PM', actor: 'Paolo Cruz', role: 'IT Asset Custodian', action: 'ASSET_UPDATED', record: 'PPE-00145', source: '10.10.3.22', outcome: 'Success' },
  { id: 'AUD-00882', timestamp: 'Today, 4:02:31 PM', actor: 'Mila Santos', role: 'Approving Officer', action: 'REQUISITION_APPROVED', record: 'REQ-2026-018', source: '10.10.4.08', outcome: 'Success' },
  { id: 'AUD-00881', timestamp: 'Today, 3:18:45 PM', actor: 'Ana Reyes', role: 'Employee', action: 'REQUISITION_SUBMITTED', record: 'REQ-2026-019', source: '10.10.5.11', outcome: 'Success' },
  { id: 'AUD-00880', timestamp: 'Today, 2:14:02 PM', actor: 'Elena Dizon', role: 'Management & Audit Viewer', action: 'USER_LOGIN_FAILED', record: 'USR-007', source: '10.10.6.04', outcome: 'Denied' },
];

export const adminActivityTrend = [
  { label: 'Mon', accounts: 3, roles: 1, security: 2 },
  { label: 'Tue', accounts: 5, roles: 2, security: 1 },
  { label: 'Wed', accounts: 2, roles: 1, security: 4 },
  { label: 'Thu', accounts: 6, roles: 3, security: 2 },
  { label: 'Fri', accounts: 4, roles: 2, security: 3 },
  { label: 'Sat', accounts: 1, roles: 0, security: 1 },
  { label: 'Sun', accounts: 2, roles: 1, security: 1 },
];
