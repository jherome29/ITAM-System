import client, { type ApiResponse } from './client';

// Mirrors CheckSummary / WatcherSweep / WatcherStatus in
// Backend/src/scheduler/scheduler.service.ts. A count of -1 means that
// watcher threw on its last run.
export interface CheckSummary {
  slaBreaches: number;
  pendingNudges: number;
  overdueReturns: number;
  lowStock: number;
  overdueRepairs: number;
}

export type WatcherName = keyof CheckSummary;

export interface WatcherSweep {
  at: string; // ISO timestamp the sweep finished
  trigger: 'hourly-cron' | 'daily-cron' | 'manual';
  summary: Partial<CheckSummary>;
}

export interface WatcherRun {
  at: string;
  trigger: WatcherSweep['trigger'];
  count: number;
}

export interface WatcherStatus {
  lastSweep: WatcherSweep | null;
  // Optional so a backend that predates per-watcher status still type-checks.
  watchers?: Partial<Record<WatcherName, WatcherRun>>;
}

export const schedulerApi = {
  /** GET /api/v1/notifications/watcher-status — SYSTEM_ADMIN only. */
  watcherStatus: () =>
    client
      .get<ApiResponse<WatcherStatus>>('/v1/notifications/watcher-status')
      .then((r) => r.data),

  /** POST /api/v1/notifications/run-checks — runs every watcher now (SYSTEM_ADMIN). */
  runChecks: () =>
    client
      .post<ApiResponse<CheckSummary>>('/v1/notifications/run-checks')
      .then((r) => r.data),
};
