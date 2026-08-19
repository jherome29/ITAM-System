import { assetMockRows } from '@/lib/mock/assets.mock';

// Frontend-only prototype.
// Backend authorization and persistence will be implemented in a later phase.
export const mockAssetsService = {
  list: () => assetMockRows,
  listIct: () => assetMockRows.filter((asset) => asset.scope === 'ICT'),
  listProperty: () => assetMockRows.filter((asset) => asset.scope !== 'ICT'),
  assignedToEmployee: (employeeId: string) => assetMockRows.filter((asset) => asset.assignedEmployeeId === employeeId),
};

