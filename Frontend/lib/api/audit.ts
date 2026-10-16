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
  /** Who did it, by name; null when the account no longer resolves. */
  userName?: string | null;
  /** What it was done to, in words ("AR-2026-0014"); null when the API cannot describe it. */
  recordLabel?: string | null;
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

  /** One record's history, newest first by the screen. The API returns the list itself under `data`. */
  byRecord: (recordId: string) =>
    client.get<ApiResponse<AuditLog[]>>(`/v1/audit/record/${recordId}`).then((r) => r.data),
};
