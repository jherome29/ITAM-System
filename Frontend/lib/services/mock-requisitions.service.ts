import { requisitionMockRows } from '@/lib/mock/requisitions.mock';

// Frontend-only prototype.
// Backend authorization and persistence will be implemented in a later phase.
export const mockRequisitionsService = {
  list: () => requisitionMockRows,
  byRequester: (requesterId: string) => requisitionMockRows.filter((request) => request.requesterId === requesterId),
  pendingApproval: () => requisitionMockRows.filter((request) => request.status === 'Pending Approval'),
  approvedForFulfillment: () => requisitionMockRows.filter((request) => ['Approved', 'Pending Fulfillment'].includes(request.status)),
};

