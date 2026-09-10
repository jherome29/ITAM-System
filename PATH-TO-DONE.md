# AIMRS — Path to Done

Everything between **feature-complete** and **CICC handover**, in rough order.
`FEATURE-STATUS.md` = what the system does today; this file = what's left to ship.
Each line links the doc that has the detail.

Legend: `[ ]` not started · `[~]` partly done · `[x]` done.

> **2026-09-10 — tracker sync.** Everything that was "PR pending" across the status
> docs is now **merged to `origin/main`**: notifications/SLA (#84), replacement
> validation (#86), system config (#87), alternate approver (#89/#90), the formal
> Jest security suite (#92), asset-registry card layout (#94), the Docker/deploy
> pass (#95), `fix/admin-shell-ui` (#96), and the Master Admin dashboard rebuild +
> admin-hardening pass (#98); develop→main via #97/#99. `origin/develop` and
> `origin/main` are byte-identical. Only unmerged branch: `docs/admin-dashboard-plan`
> (2 superseded doc commits). Health on that tree (2026-09-10): backend `tsc` clean +
> 303/303 unit tests; frontend `tsc` clean + 40/40 tests + production build clean.
> Not re-run this pass: ESLint (both), backend webpack build, coverage %,
> `audit:check` (both), `secretlint`, backend e2e (Docker), Docker image builds.

---

## A. Finish the build  → `FEATURE-STATUS.md` (🔴 + ⬜)

- [~] Wire the 3 mock screens whose backend exists — Approving Officer `approval-history`,
      Property Officer `disposal` + `audit` (`isLiveFetchPage` one-liners). `MOCK-DATA-WIRING.md` task E.
- [ ] Delete the dead mock code (5 `mock-*.service.ts`, `laptops.mock.ts`, etc.). `MOCK-DATA-WIRING.md` Part A.
- [ ] **Disposal workflow** — documented flow + COA-required fields. `SYSTEM-STATUS.md` #4.
- [ ] **Physical count / reconciliation** — unblocks RPCI / RPCPPE / Physical Count Summary. `SYSTEM-STATUS.md` #8.
- [x] ~~Master Admin governance backend~~ — **cut as out of scope (2026-09-09).** The mock
      governance/platform pages + `admin.mock.ts` were deleted; the Master Admin dashboard
      was rebuilt on live data (`GET /api/v1/admin/dashboard-stats`). `MOCK-DATA-WIRING.md` Part D #6.
- [x] ~~Master Admin admin-hardening pass~~ — **done (2026-09-09, same branch).** Force
      sign-out (`PATCH /v1/users/:id/revoke-sessions`), unlock wired into the directory +
      **Locked** status + role filter, per-account activity (`GET /v1/audit/user/:id`),
      audit `startDate`/`endDate`, `system-config` `meta`, `GET /v1/notifications/watcher-status`.
      Test-first, +~40 tests. `SYSTEM-STATUS.md` 2026-09-09 follow-up note.
- [ ] **Trends / utilisation endpoint** — for the Management dashboard chart panels. `MOCK-DATA-WIRING.md` Part D #7.
- [ ] Small wiring leftovers — employee "assigned assets" filter, Returns/Incidents module. `MOCK-DATA-WIRING.md` Part B.

## B. COA form correctness  → `docs/guides/COA-FORMS-AUDIT.md`

- [ ] Fix the Move-In / Move-Out hardcoded Property-Type bug (misrepresents real data).
- [ ] Rebuild the missing sections in WMR and IIRUP.
- [ ] Fix the RSMI zeroed-cost bug.
- [ ] Systematic field / signatory correction pass across all 18 forms vs their reference files.

## C. Phase 5 — Testing & Evaluation  → `docs/phases/PHASE-5-TESTING.md`

> **Sequencing decision (2026-08-30):** everything here except the security Jest suite
> tests the *whole system surface*, so running it before the build is functionally
> complete means re-running / re-triaging it after every new module. Do those **once, at
> the end**, on prod-like infra. The security suite is the exception — security tests
> *accumulate*, they don't expire when features are added — so its skeleton is being
> built **now** as a permanent CI gate.

- [x] **Formal Jest security suite** — all 8 Step-5.1 scenarios in
      `Backend/test/security.e2e-spec.ts` — **merged to `main` via PR #92**:
      no-token 401, privilege escalation 403 (+ forged-role JWT still 403), tampered JWT 401,
      lockout 403 with no timing leak, `@Throttle` limit asserted, audit-log immutability,
      unknown-field 400 + SQLi bound safely, no `passwordHash`/`refreshTokenHash` in responses.
      Rate limiting confirmed present (`@nestjs/throttler`, login 10/min). Runs in CI
      `backend-e2e`. Per-module privilege-escalation cases get added as those modules land.
      `docs/guides/SECURITY.md`.
- [ ] Frontend test coverage — no coverage gate on `Frontend/` yet (backend has 70%).
- [ ] **OWASP ZAP scan** *(after the build)* — you run ZAP against the running system,
      save the PDF; then paste HIGH findings for fixes (`PHASE-5-TESTING.md` §5.3–5.4).
- [ ] **JMeter load test** *(after the build)* — 362 users, 60s ramp, the 4 hot endpoints.
      Needs a **production build**, a **dedicated Postgres** (Supabase dev caps connections
      ~60), and **realistic data volume**. The `.jmx` plan can be authored earlier.
  - [x] **k6 baseline done** (`perf/`, `chore/docker-compose-fix`) — 362 VUs on `GET /assets`
        against a seeded docker Postgres: 0 errors, p95 758 ms on a single contended box.
        De-risks the formal run; DB query is ~1 ms, the ceiling is the single Node event
        loop → scale with backend replicas if the formal test confirms it.
- [ ] **UAT with CICC** *(after the build)* — structured instrument for Employees /
      Supervisors / IT Personnel; measure requisition time, inventory accuracy,
      access-control enforcement, audit completeness, satisfaction vs the manual process.

## D. Production readiness  → CLAUDE.md §2, §13, §15  (blocked on CICC server access)

- [ ] Real PostgreSQL (CICC-managed), not Supabase — verify all code runs against raw PG.
- [x] The `rejectUnauthorized: false` code hack is gone — `app.module.ts` now reads
      `DATABASE_SSL` (default = verified TLS; `no-verify` is a `.env`-only dev override).
      With real CICC certs, just leave `DATABASE_SSL` unset.
- [ ] Set `TRUST_PROXY=1` on the CICC server (behind their reverse proxy) so audit-log
      IPs are the real client. CICC IT's proxy must forward `X-Forwarded-For`.
- [ ] Docker: `docker compose -f docker-compose.prod.yml` — external managed Postgres via
      `DATABASE_URL`, external TLS/reverse-proxy (CICC IT). Both Dockerfiles + compose
      verified building/running (merged, PR #95) — the prod-compose shakeout against a
      real managed PG is still open.
- [ ] `prod-server` GitHub Environment + manual approval gate; `docker-compose.prod.yml` shakeout.
- [ ] Environment config (`.env`) for prod — JWT secret, DB URL, etc., via secrets not files.
- [ ] Backup / restore procedure + a tested restore.
- [ ] Run the full migration set (`Database/schemas/001..007`) against the prod DB, in order.

## E. Data onboarding  (not tracked elsewhere)

- [ ] Import ~362 personnel — employee ID, name, email, division, office/section, role.
- [ ] Import ~2,000 assets with all required fields (CLAUDE.md §5.3), accountable-officer mapping.
- [ ] Set initial custodian assignments and per-section supervisors (needed for approval routing
      *and* the alternate-approver designation).
- [ ] Seed system-config values if CICC's SLA / thresholds differ from the defaults.

## F. Compliance & handover  → CLAUDE.md §8, §14

- [ ] Data-minimisation / privacy review vs RA 10173 + NPC Circular 2023-06; Privacy Impact
      Assessment; confirm no HR/payroll/leave data anywhere.
- [ ] Security testing report (ASVS checklist results) for the capstone paper.
- [ ] User manuals per role; System Administrator runbook (reset-password, unlock, config,
      migrations, backup).
- [ ] Final documentation + CICC acceptance sign-off (timeline: Sep 16 – Oct 5, 2026).

---

**Suggested order:** A (finish build) → B (forms) interleaved → C (Phase 5) → D + E (once CICC
gives server + data access) → F (handover). C's UAT and D/E can't fully start until the build is
functionally complete.
