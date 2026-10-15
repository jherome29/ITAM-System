import { Credentials } from './accounts';

// Minimal paced HTTP client for the seed. It talks to the real API as real
// users, so every write goes through the same validation, audit trail and
// notifications as in normal use.

/** App rate limit is 60 requests / 60 s per IP — stay comfortably under it. */
const DEFAULT_PACE_MS = 1_100;
const RATE_LIMIT_WAIT_MS = 25_000;
const MAX_RATE_LIMIT_RETRIES = 5;

export class ApiError extends Error {
  constructor(
    readonly step: string,
    readonly status: number,
    detail: string,
  ) {
    super(`${step} failed (HTTP ${status}): ${detail}`);
  }
}

export interface Session {
  token: string;
  userId: string;
  employeeId: string;
}

interface Envelope<T> {
  data: T;
  message?: string | string[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Server error text only — never the request body, which may hold a password. */
function errorDetail(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    return Array.isArray(message) ? message.join('; ') : String(message);
  }
  return 'no error detail';
}

export class ApiClient {
  private lastCall = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly paceMs = DEFAULT_PACE_MS,
  ) {}

  /**
   * Sends one request and returns the envelope's `data`. `body` may be a JSON
   * object or a FormData (the asset-request endpoint is multipart). Throws an
   * ApiError naming `step` on any non-2xx response, so the run stops at the
   * first problem instead of piling more writes on top of it.
   */
  async call<T>(
    step: string,
    session: Session | null,
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: object | FormData,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const wait = Math.max(0, this.paceMs - (Date.now() - this.lastCall));
      if (wait > 0) await sleep(wait);
      this.lastCall = Date.now();

      const headers: Record<string, string> = {};
      if (session) headers.Authorization = `Bearer ${session.token}`;
      let payload: FormData | string | undefined;
      if (body instanceof FormData) {
        payload = body;
      } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }

      const res = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: payload,
      });

      if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        console.log(
          `   (rate limited — waiting ${RATE_LIMIT_WAIT_MS / 1000}s)`,
        );
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }

      const parsed: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(step, res.status, errorDetail(parsed));
      return (parsed as Envelope<T>).data;
    }
  }

  /** One login per account per run: each login invalidates that account's earlier sessions. */
  async login(step: string, creds: Credentials): Promise<Session> {
    const data = await this.call<{
      accessToken: string;
      user: { id: string; employeeId: string };
    }>(step, null, 'POST', '/v1/auth/login', {
      emailOrEmployeeId: creds.login,
      password: creds.password,
    });
    return {
      token: data.accessToken,
      userId: data.user.id,
      employeeId: data.user.employeeId,
    };
  }
}
