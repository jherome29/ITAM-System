import client, { type ApiResponse } from './client';

// Mirrors AdminDashboardStats in Backend/src/admin/admin.service.ts.
export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    locked: number;
    byRole: Record<string, number>;
  };
  requisitions: {
    pendingSupervisor: number;
    slaBreached: number;
  };
  assets: {
    total: number;
    available: number;
    lowStock: number;
  };
  audit: {
    failedLoginsToday: number;
    eventsToday: number;
  };
  generatedAt: string;
}

export const adminApi = {
  /** GET /api/v1/admin/dashboard-stats — SYSTEM_ADMIN only. */
  dashboardStats: () =>
    client
      .get<ApiResponse<AdminDashboardStats>>('/v1/admin/dashboard-stats')
      .then((r) => r.data),
};
