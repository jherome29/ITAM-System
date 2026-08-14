import { requisitionMockRows } from './requisitions.mock';

export const approvalMockRows = requisitionMockRows.filter(
  (request) => request.approvingOfficer === 'Mila Santos' && request.requesterId !== 'EMP-003',
);
