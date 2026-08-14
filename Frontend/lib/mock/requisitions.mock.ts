export type MockRequisitionStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Returned for Revision'
  | 'Approved'
  | 'Pending Fulfillment'
  | 'On Hold'
  | 'Fulfilled'
  | 'Rejected'
  | 'Cancelled';

export interface MockRequisition {
  id: string;
  requesterId: string;
  requester: string;
  office: string;
  item: string;
  scope: 'ICT' | 'PROPERTY' | 'SUPPLY';
  requestType: 'New' | 'Replacement' | 'Repair' | 'Return';
  quantity: number;
  priority: 'High' | 'Normal' | 'Low';
  status: MockRequisitionStatus;
  submittedDate: string;
  requiredDate: string;
  approvingOfficer: string;
  lastUpdate: string;
  justification: string;
  remarks?: string;
  timeline: string[];
  attachments: string[];
}

export const requisitionMockRows: MockRequisition[] = [
  {
    id: 'REQ-2025-018',
    requesterId: 'EMP-001',
    requester: 'Ana Reyes',
    office: 'Digital Forensics',
    item: 'Laptop replacement',
    scope: 'ICT',
    requestType: 'Replacement',
    quantity: 1,
    priority: 'High',
    status: 'Pending Approval',
    submittedDate: '2025-06-24',
    requiredDate: '2025-07-04',
    approvingOfficer: 'Mila Santos',
    lastUpdate: '2025-06-24 10:32',
    justification: 'Current device is due for refresh and intermittently overheats during imaging.',
    timeline: ['Draft created', 'Submitted for approval'],
    attachments: ['diagnostics-summary.pdf'],
  },
  {
    id: 'REQ-2025-017',
    requesterId: 'EMP-002',
    requester: 'Mark Santos',
    office: 'Incident Response',
    item: 'Network switch',
    scope: 'ICT',
    requestType: 'New',
    quantity: 1,
    priority: 'Normal',
    status: 'Approved',
    submittedDate: '2025-06-21',
    requiredDate: '2025-07-08',
    approvingOfficer: 'Mila Santos',
    lastUpdate: '2025-06-22 14:10',
    justification: 'Additional ports needed for incident room expansion.',
    timeline: ['Submitted for approval', 'Approved by Mila Santos'],
    attachments: [],
  },
  {
    id: 'REQ-2025-016',
    requesterId: 'EMP-001',
    requester: 'Ana Reyes',
    office: 'Digital Forensics',
    item: 'Evidence barcode labels',
    scope: 'SUPPLY',
    requestType: 'New',
    quantity: 3,
    priority: 'Normal',
    status: 'Fulfilled',
    submittedDate: '2025-06-19',
    requiredDate: '2025-06-28',
    approvingOfficer: 'Mila Santos',
    lastUpdate: '2025-06-23 09:45',
    justification: 'Case evidence processing stock replenishment.',
    timeline: ['Submitted for approval', 'Approved', 'Issued by Property Custodian'],
    attachments: [],
  },
  {
    id: 'REQ-2025-015',
    requesterId: 'EMP-001',
    requester: 'Ana Reyes',
    office: 'Digital Forensics',
    item: 'Evidence camera battery',
    scope: 'PROPERTY',
    requestType: 'Replacement',
    quantity: 2,
    priority: 'Low',
    status: 'Returned for Revision',
    submittedDate: '2025-06-12',
    requiredDate: '2025-07-01',
    approvingOfficer: 'Mila Santos',
    lastUpdate: '2025-06-14 11:12',
    justification: 'Battery units no longer hold charge.',
    remarks: 'Please attach current asset tag and damage photo.',
    timeline: ['Submitted for approval', 'Returned for revision'],
    attachments: [],
  },
];
