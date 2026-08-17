import { requisitionMockRows } from '@/lib/mock/requisitions.mock';

// Frontend-only prototype.
// Backend authorization and persistence will be implemented in a later phase.
export const mockApprovalsService = {
  queueForApprover: (approverName: string, approverEmployeeId: string) =>
    requisitionMockRows.filter(
      (request) =>
        request.approvingOfficer === approverName &&
        request.requesterId !== approverEmployeeId &&
        request.status === 'Pending Approval',
    ),
  historyForApprover: (approverName: string) =>
    requisitionMockRows.filter(
      (request) =>
        request.approvingOfficer === approverName &&
        ['Approved', 'Rejected', 'Returned for Revision'].includes(request.status),
    ),
};

