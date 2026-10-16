# AIMRS — Team Handoff Guide

> **For:** Nelson James Casambros · Andrei Fredrick Montaniel · Jairus Nathan Valenton
> **Target Completion:** October 2026
> **Last updated:** October 16, 2026

Read this file first, then **CLAUDE.md** (the single source of truth for the whole project). Everything else is linked from one of these two.

---

## 1. Which Branch to Clone

```bash
git clone <repo-url>
cd cicc
git checkout develop
```

**Always work off `develop`.** `main` is production/handover — never push directly to either. See §8 below for the full flow.

If you have an old local clone with a branch called `FE-Updated-not-finished`: that branch is superseded. Everything it had — the 7-role frontend redesign — plus the backend wiring for it, the 2 new roles (Property Custodian, Property Officer), real login for all 7 roles, and a security fix-wave are all merged into `main` and `develop` now. There's no reason to build from that branch anymore; delete your local copy of it if you have one.

**Now on `main` (since 2026-08-21):** `fix/dead-ui-controls-and-logout-crash` — a systematic re-audit that fixed the logout button/endpoint crash, a notifications IDOR, and ~10 correctness bugs from uppercase-vs-lowercase-enum mismatches across reports, lifecycle updates, user/role management, and audit filtering.

**Now on `main` (2026-08-27, PR #82 → #83):** the full redesigned-layout backend wiring — all 5 porting phases. IT Asset Custodian, Approving Officer, Property Custodian, Property Officer, Management & Audit, and Master Admin's Users/Roles/Audit now call the real backend. What's still mock is greenfield backend work only — see `MOCK-DATA-WIRING.md`.

**Now on `main` (merged 2026-08-28 → 2026-09-10; `origin/develop` and `origin/main` are byte-identical):**
- **PR #84** — automated notification watchers (SLA breach, 12 h pending nudge, overdue return, low stock) via a new `scheduler` module + `@nestjs/schedule`; supply-stock model (quantity/reorder level, transactional decrement on fulfill). Dedup stamps + an admin `run-checks` endpoint.
- **PR #86** — replacement-requisition validation: a `replacement` requisition is only accepted if the requester holds the asset *and* it is unserviceable or past its useful life.
- **PR #87** — System Config module: `system_config` key-value table (migration 006), `GET`/`PATCH /api/v1/system-config` (SYSTEM_ADMIN, audited); SLA hours / reorder level / useful-life years / max login attempts are runtime-tunable and read live. UI: **Master Admin → System Settings**; old `/admin/config` deleted.
- **PR #89 / #90** — Alternate Approver: designate a backup supervisor; when the primary is marked unavailable (self-service toggle or admin) new requisitions route to the backup at submit; a requisition past its 24 h SLA is reassigned to the backup by the watcher (migration 007, `requisition_reassigned` audit action).
- **PR #92** — `chore/phase5-security-tests`: `Backend/test/security.e2e-spec.ts` expanded to all 8 PHASE-5-TESTING Step 5.1 scenarios, plus `npm run test:e2e:local` (a throwaway `postgres:16` for running the e2e suite locally the way CI does).
- **PR #94** — `Jairus/Update-Asset-Registry`: asset-registry card layout + register-asset-in-modal + a `requestedAssetClass` list filter.
- **PR #95** — `chore/docker-compose-fix`, the Docker/deploy pass: **both Dockerfiles now build** (were broken — monorepo import escaped `context: ./Backend`; now repo-root context, `node:22-alpine`, non-root, one root lockfile). Compose reworked (root context, all 7 schemas, `/api/health` healthchecks, prod `${VAR:?err}` fail-fast + build args). New `GET /api/health`. `DATABASE_SSL` env replaces the `rejectUnauthorized` hack. `DB_POOL_MAX` / `THROTTLE_LIMIT` / `THROTTLE_TTL` env-tunable. Real bcrypt hash in the dev seed. CI `docker-build` job. `perf/` k6 load baseline (362 VUs, 0 errors, p95 758 ms on a contended single box). `Backend/.env.example` added.
- **PR #96** — `fix/admin-shell-ui`: dead `/` breadcrumb crumb removed + acronym labels, slim custom scrollbars app-wide, collapsed-sidebar overlap fix, **`PATCH /users/:id/activate`** (reactivate a deactivated account) + an in-app `PasswordResetDialog` (replaces `window.prompt`), Toast auto-dismiss, `TRUST_PROXY` so audit entries log the real client IP behind a proxy, CLAUDE.md §14 date table trimmed.
- **PR #98** — `feature/master-admin-dashboard`: Master Admin governance/platform mock pages + `admin.mock.ts` **cut as out of scope** (2026-09-09); dashboard rebuilt on live data (`GET /api/v1/admin/dashboard-stats`). Then an admin-hardening pass: **force sign-out** (`PATCH /users/:id/revoke-sessions` — bumps `tokenVersion` only), **unlock** wired into the directory + live **Locked** status + role filter, **per-account activity** panel (`GET /audit/user/:id`), **audit date range** (`startDate`/`endDate` on `GET /audit`), **config provenance** (`meta` on `GET /system-config`), **watcher heartbeat** (`GET /notifications/watcher-status`). Backend test-first, +~40 tests (303 total). No schema change.

**Merged to `develop` (2026-10-14): PR #102 and #103** — Returns & Incidents (schemas 010–012), Maintenance & Repair with loaner units (013–014), derived request types + the replacement flow (repeat repairs qualify, the new unit is issued on fulfilment, the requester gets the receipt), self-approval routing fix, notification deep-links, catalogue item picker (008–009), per-watcher status, next 16.4.0. `develop` is 27 commits ahead of `main`.

**Merged to `develop` on 2026-10-16: #105, #106, #107 and #109.**

| PR | What |
|---|---|
| #105 | access control, audit integrity, requisition numbering, TZ, KPIs, real client IP, `GET /users` admin-only (schema 015) |
| #106 | removes every mock screen; real disposal review, physical-inventory count sheet, approval history, management dashboard |
| #107 | `npm run seed:demo`: repeatable pilot data through the real API |
| #108 / #109 | the 12 UI/export audit defects, forms redesign, running document numbers (schema 016), Property Custodian files requisitions, PDF layout fixes. **#108 was merged into the already-merged `feat/pilot-demo-data` branch by mistake** (its base was not retargeted after #106 merged), so #109 delivered it into `develop`. When you stack PRs, check the base reads `develop` before you merge |

`main` is still behind `develop`; `develop` → `main` needs 2 reviews and every check green. **Schemas 008–017 must be applied to every database that predates them** (shared Supabase is at 016, with **017 not yet applied**; your local Docker Postgres may be older) — `Database/README.md` has the table. Several contain `ALTER TYPE … ADD VALUE`, so run them with plain `psql -f`, not one transaction; all are safe to re-run.

**Property Officer merged into Property Custodian (2026-10-16).** The Property Officer was a read-only subset of the Property Custodian, so the role was retired: schema `017` turns existing Property Officer accounts into Property Custodians (and invalidates their sessions); the `property_officer` value stays in the Postgres and shared `UserRole` enums, deprecated, because old audit rows carry it; no route grants it and the API refuses to assign it. The Replacement Validation and Disposal Review screens moved into the Property Custodian's menu. **Run `017` on Supabase dev before starting a backend that includes it**, or `property.officer@cicc.gov.ph` is refused everywhere.

**Open items:** SonarCloud's quality gate fails ("C Reliability Rating on New Code") and the issue is not yet identified; see `NEXT-TIME.md`.

**Health (2026-10-16):** every `CHECKS.md` item clean; backend 800 unit tests (96% statements) and 94 e2e tests on a real Postgres; frontend 327 tests. Screens and all 18 PDFs were also driven/rendered against a throwaway database.

For a one-screen state map see **`FEATURE-STATUS.md`** (✅ / 🟡 / 🔴 mock / ⬜); for the full path to CICC handover see **`PATH-TO-DONE.md`**; for the plain-language gap list see **`SYSTEM-STATUS.md`**; for a screen-by-screen mock inventory see **`MOCK-DATA-WIRING.md`** — all at the repo root.

---

## 2. Local Setup

### Prerequisites
- Node.js 20.9+ (Next 16's minimum; the Docker images use Node 22), npm 10+, Git. Docker Desktop for the local database and the e2e suite

### Install dependencies
```bash
# From the project root — installs Frontend + Backend + packages/shared
npm install
```

### Running tests
```bash
cd Backend && npm run test            # unit
cd Backend && npm run test:cov        # unit + coverage thresholds
cd Backend && npm run test:e2e:local  # e2e — needs Docker; spins a throwaway
                                      # postgres:16 (docker-compose.e2e.yml),
                                      # NODE_ENV=test, like CI's backend-e2e job.
cd Frontend && npm run test           # frontend (vitest)
```
Plain `npm run test:e2e` boots against Supabase and jest can't connect — always
use the `:local` variant on a dev machine.

### Environment files

**Backend — create `Backend/.env`:**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=                 # ask a teammate — shared dev Supabase instance
JWT_SECRET=                   # ask a teammate
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=           # ask a teammate
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

**Frontend — create `Frontend/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Start the servers
```bash
# Terminal 1 — Backend
cd Backend && npm run start:dev
# Wait for: "Nest application successfully started"

# Terminal 2 — Frontend
cd Frontend && npm run dev
# Open: http://localhost:3000
```

> **Windows tip — port already in use:**
> ```powershell
> $p = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess
> if ($p) { Stop-Process -Id $p -Force }
> ```

> **TLS error connecting to Supabase (`self-signed certificate in certificate chain`):** this happens on some machines/networks that intercept TLS. There is no longer a code workaround — set **`DATABASE_SSL=no-verify` in `Backend/.env`** and leave `app.module.ts` alone. Default (unset) is verified SSL; `no-verify` only disables the cert check on *your* box. `disable` (no SSL) is for the local docker-compose Postgres.

---

## 3. Test Login Credentials (shared dev Supabase)

| Role | Email | Password |
|---|---|---|
| System Administrator | admin@cicc.gov.ph | Admin@CICC2026! |
| IT Personnel | itpersonnel@cicc.gov.ph | CiccIT@2026!Sec |
| Supervisor | supervisor@cicc.gov.ph | Supervisor@CICC2026! |
| Employee | employee@cicc.gov.ph | Employee@CICC2026! |
| Management | management@cicc.gov.ph | Management@CICC2026! |
| Property Custodian | property.custodian@cicc.gov.ph | PropertyCustodian@2026! |
| Supervisor (Approving Officer, Property and Supply Management) | psm.approver@cicc.gov.ph | PSMApprover@2026! |

The 2 Property role accounts, scoped to Fixed + Supplies assets, already existed in the shared dev DB but had no known-working password until 2026-08-21, when they were reset via the real `PATCH /api/v1/users/:id/reset-password` endpoint and verified with a live login. If these no longer work, someone has reset them again since — check with the team rather than assuming this doc is wrong.

> If an account is locked (too many failed logins), a System Admin can unlock it: `PATCH /api/v1/users/:id/unlock`, or force a password reset: `PATCH /api/v1/users/:id/reset-password`. To end a suspect session without changing the password: `PATCH /api/v1/users/:id/revoke-sessions` (`feature/master-admin-dashboard`).

The last account (`CICC-SUP-002`, alternate approver `CICC-ALT01`) was created on 2026-10-16 so the Property Custodian, who now files requisitions, has an approver: requests route to the Approving Officer of the requester's section, then division, and the Property Custodian is in the *Property and Supply Management* division. `supervisor@cicc.gov.ph` (Maria Santos, Operations / Field Operations) is unchanged.

> **These are dev credentials in a public repo.** They are listed here, in `ROLES.md`, `RUN-LOCAL.md` and the `CHECKS.md` smoke tests, and nowhere else: do not copy them into code, issues or chat. Rotate them before handover (`PATH-TO-DONE.md` §F).

Full role details, the permission matrix and page routes: **`docs/guides/ROLES.md`**

---

## 4. What Has Been Built

### Merged to `main` since 2026-08-28 (see §1 for the PR list)
- **Automated notifications + SLA enforcement** — cron watchers fire once each (dedup) and reach every relevant role; live TopBar bell; `POST /notifications/run-checks` triggers a pass on demand.
- **System Config** — SLA hours / default reorder level / useful-life years / max login attempts editable at runtime (admin, audited), read live by the workflow / watchers / auth.
- **Replacement validation** — enforced in `requisitions.service.create()`.
- **Alternate approver** — planned-absence routing at submit + SLA-breach reassignment; supervisor self-service availability; admin designation panel.
- **Formal security e2e suite** (merged, PR #92) — 8 ASVS scenarios end-to-end, runs in CI's `backend-e2e`.
- **Master Admin dashboard rebuilt on live data** + admin-hardening pass (force sign-out, unlock wired, per-account activity, audit date range, config `meta`, watcher heartbeat) — merged, PR #98.
- **Docker/deploy pass** (merged, PR #95) + `fix/admin-shell-ui` (merged, PR #96).

### On `develop` (PR #102 / #103)
- **Requisitions** — request type derived (`supply` / `new` / `replacement`), `repair` refused; items picked from live inventory with a "Not in inventory" flag; replacement starts from My Assigned Assets after an eligibility check; fulfilling takes the old unit back with a Receipt and can issue the new unit in the same step; a requisition is never routed to or decided by its own requester.
- **Returns & Incidents** (CLAUDE.md Module 6) — return / repair / damage / loss / theft with attachments, two-step custodian decision, one open case per item, auto-generated COA documents the requester can download; System Admin decides a custodian's own request.
- **Maintenance & Repair** (Module 7) — `asset_repairs` record per repair stay, queue for both custodians, loaner unit, outcome repaired / not repairable, condition follows the lifecycle, overdue-repair watcher, Repair History report.
- **My Assigned Assets** for every role; notification clicks deep-link to the record's drawer.

### In the open PR stack (#105 – #108)
- **No mock data left** (#106): every reachable screen reads real records and every button saves through the API; the pre-redesign shells are deleted. Real Disposal Review, Physical Inventory count sheet (read-only), Approval History and Management dashboard.
- **Audit and access fixes** (#105): record-history scope, requisition-number race, CICC time (Asia/Manila), SLA KPI, real client IP from `req.ip`, `GET /users` admin-only, restore-from-flagged.
- **Forms** (#108): real running document numbers per transaction (`PAR-2026-0001`), entity name and Fund Cluster as System Settings, a forms archive searchable by number, the **Reports & Forms** redesign, the Audit Trail Report, tables that paginate and fit the page, RSMI / RPCI that no longer print guesses, a form number that no longer prints over its label.
- **The Property Custodian files requisitions** (#108): requisitions and replacements. A custodian never fulfils their own; the System Administrator is the fallback (Master Admin → Requisition Fulfilment). Management and the System Administrator do not file.
- **UI polish** (#108): Manila-day dates, a real reason (10+ characters) and a confirmation to reject, a server-side date rule for incidents, supply stock draw-down on fulfilment, audit screens that name people and records.
- **Demo data** (#107): `npm run seed:demo` loads pilot data through the real API.

### Solid, all on `main`
- Auth: JWT + httpOnly refresh tokens, bcrypt, account lockout, RBAC guards, real login for all 6 roles — no mock accounts anywhere in the codebase anymore
- 6 roles: the original 5 (Employee, Supervisor, IT Personnel, System Admin, Management) plus Property Custodian, scoped to Fixed + Supplies assets (a seventh, the read-only Property Officer, was merged into it on 2026-10-16)
- Assets module: registry, lifecycle state machine, QR generation, search + status filter, asset-type scope enforcement on every write path (not just reads)
- Requisitions module: submit → approve/reject → fulfill workflow, real end to end as of 2026-08-19 — both the API and the actual UI (Supervisor's queue, the Approving Officer's real-time queue, and IT Personnel's fulfillment page all work against real data with real actions now, not just tested at the API level)
- Audit module: append-only log, action filter, per-record lookup — now including User Management (was the one module missing it; fixed 2026-08-19)
- Notifications module: in-system alerts, mark read, mark all read — **now auto-created** by the `scheduler` cron watchers (merged, see §1)
- Users module: CRUD, role assignment, deactivate, reset password, unlock, search
- Reports module: real PDF (pdfkit) + Excel (exceljs), all 18 COA forms (generation mechanism is solid; several forms' *layout* diverges from the official template — see `docs/guides/COA-FORMS-AUDIT.md`)
- **The whole redesigned layout is wired now (2026-08-27, on `main`).** All 5 porting phases: IT Asset Custodian (every screen), Approving Officer (dashboard + queues + real actions), Property Custodian & Property Officer (dashboards, asset registries, QR, fulfillment/custody/disposal), Management & Audit Viewer (dashboard KPIs, all report tabs, forms archive, audit), Master Admin (Users/Roles/Audit + 2 of 6 dashboard panels), and a shared COA-forms generator. Screen-by-screen mock inventory: `MOCK-DATA-WIRING.md`.
- Asset registration: a real, reachable, working page now exists in navigation for IT Asset Custodian and Property Custodian
- Report generation, asset lifecycle updates, user creation, and role assignment — all previously *wired but silently broken* by uppercase-vs-lowercase-enum mismatches — fixed on `main`.

### Not built (so not offered)
There are no mock screens any more; these simply do not exist (`MOCK-DATA-WIRING.md`, `FEATURE-STATUS.md` ⬜):
- Recording a physical count / reconciliation (the count sheet is read-only) and inventory corrections.
- Trends / utilisation reporting and the Asset Utilization Summary report.
- Master Admin governance pages (cut as out of scope, PR #98); the Stock Card (Appendix 58).

---

## 5. What Still Needs to Be Done

Don't duplicate the gap list here — **`PATH-TO-DONE.md`** (everything between here and CICC handover) and **`SYSTEM-STATUS.md`** (the plain-language gap list + suggested order) at the repo root are the maintained versions. Highlights as of this handoff:

| Priority | Item |
|---|---|
| 1 | `develop` → `main` (2 reviews, all checks); apply schema `017` to Supabase dev first; look at SonarCloud's failing gate |
| 2 | Period reports: an end date is treated as midnight, so items created later that day are left out (small, real bug) |
| 3 | COA form fidelity (`docs/guides/COA-FORMS-AUDIT.md`): Move-In / Move-Out "Property Type: Office" always, WMR and IIRUP missing sections, the extra unofficial signatory, Sticker Card vs Stock Card; then compare against `FORMS/` |
| 4 | Physical count recording / reconciliation; trends / utilisation and the Asset Utilization Summary |
| 5 | Product questions: Annex A.4 scope, asset history by person, PAR / ICS Office/Section (`SYSTEM-STATUS.md`) |
| 6 | Phase 5: JMeter at 362 users, OWASP ZAP, UAT with CICC, the ASVS report, a Frontend coverage gate |
| 7 | Production readiness, data onboarding, handover (blocked on CICC); rotate the dev passwords first |

Phase 5 (`docs/phases/PHASE-5-TESTING.md`): the formal Jest security suite and a k6 baseline are done; JMeter, ZAP and UAT are best run once the stack above is merged. Tooling not yet added (Husky, MFA/TOTP, idle session timeout, committed Playwright e2e): `docs/guides/FUTURE-TOOLING.md`.

---

## 6. Key Files to Read (in this order)

| # | File | Why |
|---|---|---|
| 1 | **`CLAUDE.md`** | Single source of truth. Read every section before writing code. |
| 2 | **`FEATURE-STATUS.md`** | One-screen ✅ / 🟡 / ⬜ map of the whole system. |
| 3 | **`SYSTEM-STATUS.md`** | Plain-language gap list + suggested order of work. |
| 4 | **`PATH-TO-DONE.md`** | Everything between feature-complete and CICC handover, checklist form. |
| 5 | **`CHECKS.md`** | Run every check before marking any task done. Non-negotiable. |
| 6 | **`docs/guides/ROLES.md`** | Role descriptions, permissions, page routes. |
| 7 | **`docs/guides/SECURITY.md`** | Canonical security spec — wins over CLAUDE.md on security specifics if they ever disagree. |
| 8 | **`packages/shared/src/enums/index.ts`** | All shared enums (UserRole, AssetStatus, RequisitionStatus, etc.) — use these, never hardcode strings. |
| 9 | **`docs/phases/PHASE-5-TESTING.md`** | Testing & Evaluation phase guide (Jest security tests, ZAP, JMeter). |
| 10 | **`NEXT-TIME.md`** | Where the last session stopped and what to do next. |
| 11 | **`RUN-LOCAL.md`** | Local runbook, troubleshooting, and how to verify screens and PDFs on a throwaway database. |

CLAUDE.md §18 maps every md file to the change that should update it.

---

## 7. Key Technical Rules (Do Not Break These)

The most important constraints from CLAUDE.md §11 — breaking them causes hard-to-debug failures:

1. **TypeScript strict mode only** — no plain JS, no `any` without justification.
2. **`synchronize: false` in TypeORM** — every entity change needs a manual SQL migration. Never re-enable `synchronize: true`.
3. **Audit logs are append-only** — no UPDATE or DELETE on `audit_logs`. Non-negotiable for COA compliance.
4. **`pdfkit` and `bcrypt` must stay in `Backend/webpack.config.js` externals** — remove either and PDF generation or password hashing breaks silently at runtime, not at build time.
5. **RBAC is enforced at the NestJS controller level** — every protected route needs `@Roles(...)` + guards. Frontend role checks are UX only, never trust them alone.
6. **`AssetStatus`/`RequisitionStatus` enums are lowercase** — `'available'`, `'pending_supervisor'`, etc.
7. **Login DTO uses `emailOrEmployeeId`** — not `email`. Accepts either format.
8. **One login call per test/session** — a second login for the same user invalidates the first token (`tokenVersion` increments). The reset-password endpoint also bumps it.
9. **`PATCH /assets/:id` is metadata only** — status changes must go through `PATCH /assets/:id/lifecycle`. Don't conflate the two.
10. **`ISSUED` lifecycle transitions use `employeeId`** (a CICC ID string like `CICC-0042`), not a raw UUID.

---

## 8. Git Workflow

```bash
git checkout develop
git pull origin develop
git checkout -b feature/AIMRS-<ticket>-<short-desc>

git add <specific files>
git commit -m "feat: describe what and why"

git push -u origin feature/AIMRS-<ticket>-<short-desc>
# Open PR on GitHub → target: develop
```

**Branch model is now `feature/* → develop → main`** — the old `test`/`uat` branches were dropped 2026-08-15 (they never diverged from `main`, so they were removed instead of carried forward as unused ceremony; see CLAUDE.md §13 for the full note). PR to `develop` needs 1 review + CI green; PR to `main` needs 2 reviews + all checks (including secret-scan, CodeQL, dependency audit) green.

**Never push directly to `develop` or `main`.**

---

## 9. Running the Quality Checklist

Before opening any PR, run every check in **`CHECKS.md`** in order — or tell Claude Code:
> "Read CHECKS.md and run every check one by one. Fix any failure before moving to the next."

---

## 10. Database Notes

- **Dev database:** Shared Supabase instance — do not drop tables, other teammates are using it live.
- **Schema changes:** write a `.sql` file in `Database/schemas/` (or `Database/migrations/` for post-launch changes) and run it manually in the Supabase SQL Editor. `synchronize: false` means nothing happens automatically. Schemas **001–016** are applied to dev Supabase as of 2026-10-15 (`017`, which retires the Property Officer role, is not applied yet; 008–014 on 2026-10-11, 015 on 2026-10-14, 016 on 2026-10-15). Not yet applied to any production database (there is none). `Database/README.md` lists every file.
- **Production:** raw PostgreSQL managed by CICC IT. No Supabase SDK features in application code — see `Database/README.md`.
- The `user_role` enum includes `property_custodian` and the retired `property_officer` (kept for old audit rows; never assigned); the `audit_action` enum has 34 values (e.g. `system_config_updated`, `requisition_reassigned`, `asset_request_*`, `repair_*`, `form_generated`), so a new audit action needs a schema file too.
- **Do not run the pilot on the shared Supabase dev DB**: it caps at 15 connections (run the backend with `DB_POOL_MAX=8`), and it holds test rows (`[VERIFY-2026-10-14]`) and demo rows (`DEMO-`).

---

## 11. Docker Notes (read before you touch `docker-compose build`)

Two things worth knowing (the first was found the hard way on 2026-08-19 and corrected in PR #95):

1. **The Docker build context is the repo root, and there is one lockfile.** This is an npm-workspaces monorepo and both apps import `packages/shared`, so `docker build -f Backend/Dockerfile .` (context `.`) copies `packages/shared` beside the app. Reverting to `context: ./Backend` breaks the build (the `../../../packages/shared` import escapes the context). There is a single root `package-lock.json`; there are no per-workspace lockfiles. If `docker compose build` fails on `npm ci` saying the lockfile is out of sync, regenerate the **root** lockfile (`npm install` at the repo root) and commit it (CLAUDE.md §11 #18; fixed in PR #95 — before that, both images failed to build at all).
2. **If `npm ci` fails inside the container with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`** on every registry fetch: that's TLS interception on your network (proxy, antivirus, campus/office network filtering) whose root CA your Windows host trusts but the container's own minimal certificate store doesn't. Not a code problem — it'll happen on any machine behind that kind of network, regardless of what's in the lockfile. No fix from inside this repo; either build from a network without that interception, or add the intercepting CA to the image's trust store (out of scope for now, nobody's needed to build the actual container image day-to-day yet).

---

*For questions about the codebase, read CLAUDE.md first — most answers are there. For current gaps, read SYSTEM-STATUS.md.*
