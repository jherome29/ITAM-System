import client, { type ApiResponse } from './client';

export interface HealthStatus {
  status: string; // 'ok' when the DB answered SELECT 1
  db: boolean;
  uptime: number; // backend process uptime, seconds
  reachable: boolean; // false when the request itself failed (network / 503)
}

// GET /api/health — no auth, outside the /v1 surface. The backend answers 503
// (ServiceUnavailableException) when the DB is down, which axios rejects; we
// normalise both the happy path and every failure into one HealthStatus so the
// dashboard card always has something concrete to render.
export const healthApi = {
  check: (): Promise<HealthStatus> =>
    client
      .get<ApiResponse<{ status: string; db: boolean; uptime: number }>>(
        '/health',
      )
      .then((r) => ({ ...r.data.data, reachable: true }))
      .catch((err: unknown): HealthStatus => {
        const body = (err as { response?: { data?: { data?: unknown } } })
          ?.response?.data?.data as Partial<HealthStatus> | undefined;
        return {
          status: body?.status ?? 'unreachable',
          db: body?.db ?? false,
          uptime: body?.uptime ?? 0,
          reachable: false,
        };
      }),
};
