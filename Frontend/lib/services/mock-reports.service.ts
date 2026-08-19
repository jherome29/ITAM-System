import { reportMockRows } from '@/lib/mock/reports.mock';

// Frontend-only prototype.
// Backend authorization and persistence will be implemented in a later phase.
export const mockReportsService = {
  list: () => reportMockRows,
  byType: (type: string) => reportMockRows.filter((report) => report.type === type),
};

