# AIMRS — Performance / Load Testing

Reproducible baseline load test. This is the **first-pass** check that finds
bottlenecks early; the formal JMeter run across all six workflow scenarios
(login, requisition, dashboard, QR scan, approval, report) is the
Testing-&-Evaluation phase deliverable (CLAUDE.md §12).

## What it measures

Authenticated read traffic on `GET /api/v1/assets` — the heaviest common read
path — ramped to **362 concurrent virtual users** with 0.5–1.5 s think time, so
steady state approximates every CICC user browsing at once.

## Prerequisites

- **Docker** running (uses the `docker-compose.yml` stack — isolated local
  Postgres, no network latency to a remote DB).
- **k6** (`k6 version`). Install: <https://k6.io/docs/get-started/installation/>.

## Run

```bash
# 1. Bring the stack up with the rate limiter lifted (a single load generator
#    is one IP; real users each get their own per-IP budget) and a wider pool.
THROTTLE_LIMIT=100000000 DB_POOL_MAX=30 docker compose up -d --build

# 2. Seed ~CICC data volume into the throwaway DB (~362 users, ~2,000 assets,
#    ~8,000 audit rows). Safe to re-run (ON CONFLICT DO NOTHING).
docker exec -i aimrs_postgres psql -U aimrs_user -d aimrs_dev < perf/seed-volume.sql

# 3. Run the load test.
k6 run perf/load-assets.js

# 4. Tear down (wipes the seeded volume).
docker compose down -v
```

## Thresholds (pass/fail in the k6 summary)

| Metric | Target |
|---|---|
| `http_req_failed` | < 1 % |
| `http_req_duration` p95 | < 800 ms |
| `http_req_duration` p99 | < 2000 ms |

## Caveats (why this is a baseline, not certification)

- Load generator, backend, and DB share one machine — they compete for CPU, so
  absolute numbers are pessimistic vs a real multi-host deployment.
- Only one endpoint / one workflow. The formal test exercises all six.
- No requisition-volume seed yet — add before load-testing the requisition and
  dashboard endpoints.

## CI

Deliberately **not** a CI gate — load tests are slow and environment-sensitive,
and flaky thresholds on shared runners cause false failures. If an on-demand run
is wanted, add a `workflow_dispatch` job that runs steps 1–4 and uploads the k6
summary as an artifact (no gating).
