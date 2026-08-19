export interface MockNotification {
  id: string;
  title: string;
  category: 'Requisitions' | 'Assets' | 'Returns' | 'Incidents' | 'System';
  relatedId: string;
  unread: boolean;
  message: string;
  date: string;
}

export const notificationMockRows: MockNotification[] = [
  {
    id: 'NTF-001',
    title: 'Laptop return due soon',
    category: 'Assets',
    relatedId: 'ICT-00091',
    unread: true,
    message: 'Your Dell Latitude 5440 return is due in 3 days.',
    date: 'Today',
  },
  {
    id: 'NTF-002',
    title: 'Request awaiting approval',
    category: 'Requisitions',
    relatedId: 'REQ-2025-018',
    unread: true,
    message: 'Laptop replacement is pending approval by Mila Santos.',
    date: 'Today',
  },
  {
    id: 'NTF-003',
    title: 'Supply requisition fulfilled',
    category: 'Requisitions',
    relatedId: 'REQ-2025-016',
    unread: false,
    message: 'Evidence barcode labels were issued by Property Supply.',
    date: 'Jun 23',
  },
];
