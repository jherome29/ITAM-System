import client, { type ApiResponse } from './client';

export interface AuditLog {
  id: string;
  userId: string;
  userRole: string;
  action: string;
  affectedRecordId: string | null;
  affectedRecordType: string | null;
  ipAddress: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export const auditApi = {
  list: (page = 1, limit = 50, action?: string, startDate?: string, endDate?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (action) params.action = action;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return client.get<ApiResponse<PaginatedAuditLogs>>('/v1/audit', { params }).then((r) => r.data);
  },

  byUser: (userId: string, page = 1, limit = 50) =>
    client.get<ApiResponse<PaginatedAuditLogs>>(`/v1/audit/user/${userId}`, { params: { page, limit } }).then((r) => r.data),

  byRecord: (recordId: string) =>
    client.get<ApiResponse<{ data: AuditLog[] }>>(`/v1/audit/record/${recordId}`).then((r) => r.data),
};
