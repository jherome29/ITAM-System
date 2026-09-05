// AIMRS load baseline — authenticated read traffic on the asset registry,
// the heaviest common read path. Ramps to 362 concurrent virtual users
// (CLAUDE.md §12) with think time, so steady state approximates "every CICC
// user actively browsing at once".
//
//   k6 run perf/load-assets.js
//   BASE_URL=http://host:3001/api/v1  k6 run perf/load-assets.js
//
// Requires: the backend reachable at BASE_URL with a raised per-IP rate limit
// (THROTTLE_LIMIT) — a single load generator is one IP. See perf/README.md.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3001/api/v1';
const USER = __ENV.LOGIN_USER || 'admin@cicc.gov.ph';
const PASS = __ENV.LOGIN_PASS || 'ChangeMe@1234!';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 150 },
        { duration: '40s', target: 362 },
        { duration: '40s', target: 362 }, // hold at full load
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% errors
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ emailOrEmployeeId: USER, password: PASS }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'setup login 200': (r) => r.status === 200 });
  if (res.status !== 200) {
    throw new Error(`login failed (${res.status}): ${res.body}`);
  }
  return { token: res.json('data.accessToken') };
}

export default function (data) {
  const params = {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { name: 'GET /assets' },
  };
  const page = 1 + Math.floor(Math.random() * 50);
  const res = http.get(`${BASE}/assets?page=${page}&limit=20`, params);
  check(res, {
    'assets 200': (r) => r.status === 200,
    'assets has data': (r) => {
      try {
        return Array.isArray(r.json('data.data'));
      } catch {
        return false;
      }
    },
  });
  sleep(0.5 + Math.random()); // 0.5-1.5s think time
}
