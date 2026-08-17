import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export const mockUsers = [
  { id: 'USR-001', name: 'Ricardo Torres', office: 'System Administration', role: ProposedUserRole.MASTER_ADMIN },
  { id: 'USR-002', name: 'Ana Reyes', office: 'Digital Forensics', role: ProposedUserRole.EMPLOYEE },
  { id: 'USR-003', name: 'Mila Santos', office: 'Administrative Service', role: ProposedUserRole.APPROVING_OFFICER },
  { id: 'USR-004', name: 'Paolo Cruz', office: 'ICT Unit', role: ProposedUserRole.IT_ASSET_CUSTODIAN },
  { id: 'USR-005', name: 'Leah Garcia', office: 'Property Unit', role: ProposedUserRole.PROPERTY_CUSTODIAN },
];

