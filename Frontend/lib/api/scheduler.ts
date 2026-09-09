import client, { type ApiResponse } from './client';

// Mirrors WatcherSweep in Backend/src/scheduler/scheduler.service.ts.
export interface WatcherSweep {
  at: string; // ISO timestamp the sweep finished
  trigger: 'hourly-cron' | 'daily-cron' | 'manual';
  summary: Partial<{
    slaBreaches: number;
    pendingNudges: number;
    overdueReturns: number;
    lowStock: number;
  }>;
}

export const schedulerApi = {
  /** GET /api/v1/notifications/watcher-status — SYSTEM_ADMIN only. */
  watcherStatus: () =>
    client
      .get<ApiResponse<{ lastSweep: WatcherSweep | null }>>(
        '/v1/notifications/watcher-status',
      )
      .then((r) => r.data),
};
