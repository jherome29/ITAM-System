# AIMRS — Team Handoff Guide

> **For:** Nelson James Casambros · Andrei Fredrick Montaniel · Jairus Nathan Valenton
> **Target Completion:** October 2026
> **Last updated:** September 6, 2026

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

**Landed on `develop` since 2026-08-28** (not on `main` yet — `develop` is ahead):
- **PR #84** — automated notification watchers (SLA breach, 12 h pending nudge, overdue return, low stock) via a new `scheduler` module + `@nestjs/schedule`; supply-stock model (quantity/reorder level, transactional decrement on fulfill). Dedup stamps + an admin `run-checks` endpoint.
- **PR #86** — replacement-requisition validation: a `replacement` requisition is only accepted if the requester holds the asset *and* it is unserviceable or past its useful life.
- **PR #87** — System Config module: `system_config` key-value table (migration 006), `GET`/`PATCH /api/v1/system-config` (SYSTEM_ADMIN, audited); SLA hours / reorder level / useful-life years / max login attempts are runtime-tunable and read live. UI: **Master Admin → System Settings**; old `/admin/config` deleted.
- **PR #89 / #90** — Alternate Approver: designate a backup supervisor; when the primary is marked unavailable (self-service toggle or admin) new requisitions route to the backup at submit; a requisition past its 24 h SLA is reassigned to the backup by the watcher (migration 007, `requisition_reassigned` audit action).

**Open branches awaiting merge:**
- `chore/phase5-security-tests` — expands `Backend/test/security.e2e-spec.ts` to all 8 PHASE-5-TESTING Step 5.1 scenarios, plus `npm run test:e2e:local` (a throwaway `postgres:16` for running the e2e suite locally the way CI does).
- `Jairus/Update-Asset-Registry` — **merged (PR #94)**: asset-registry card layout + register-asset-in-modal + a `requestedAssetClass` list filter.
- `fix/admin-shell-ui` — shell/admin fixes: dead `/` breadcrumb crumb removed + acronym labels, slim custom scrollbars app-wide, collapsed-sidebar overlap fix, **`PATCH /users/:id/activate`** (reactivate a deactivated account) + an in-app `PasswordResetDialog` (replaces `window.prompt`), Toast auto-dismiss, `TRUST_PROXY` so audit entries log the real client IP behind a proxy, CLAUDE.md §14 date table trimmed.
- `chore/docker-compose-fix` — the Docker/deploy pass: **both Dockerfiles now build** (were broken — monorepo import escaped `context: ./Backend`; now repo-root context, `node:22-alpine`, non-root, one root lockfile). Compose reworked (root context, all 7 schemas, `/api/health` healthchecks, prod `${VAR:?err}` fail-fast + build args). New `GET /api/health`. `DATABASE_SSL` env replaces the `rejectUnauthorized` hack. `DB_POOL_MAX` / `THROTTLE_LIMIT` / `THROTTLE_TTL` env-tunable. Real bcrypt hash in the dev seed. CI `docker-build` job. `perf/` k6 load baseline (362 VUs, 0 errors, p95 758 ms on a contended single box). `Backend/.env.example` added.

For a one-screen state map see **`FEATURE-STATUS.md`** (✅ / 🟡 / 🔴 mock / ⬜); for the full path to CICC handover see **`PATH-TO-DONE.md`**; for the plain-language gap list see **`SYSTEM-STATUS.md`**; for a screen-by-screen mock inventory see **`MOCK-DATA-WIRING.md`** — all at the repo root.

---

## 2. Local Setup

### Prerequisites
- Node.js 18+ (LTS), npm 9+, Git

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
| Property Officer | property.officer@cicc.gov.ph | PropertyOfficer@2026! |

The 2 Property role accounts, scoped to Fixed + Supplies assets, already existed in the shared dev DB but had no known-working password until 2026-08-21, when they were reset via the real `PATCH /api/v1/users/:id/reset-password` endpoint and verified with a live login. If these no longer work, someone has reset them again since — check with the team rather than assuming this doc is wrong.

> If an account is locked (too many failed logins), a System Admin can unlock it: `PATCH /api/v1/users/:id/unlock`, or force a password reset: `PATCH /api/v1/users/:id/reset-password`.

Full role details and page routes: **`docs/guides/ROLES.md`**

---

## 4. What Has Been Built

### Merged to `develop` since 2026-08-28 (see §1 for the PR list)
- **Automated notifications + SLA enforcement** — cron watchers fire once each (dedup) and reach every relevant role; live TopBar bell; `POST /notifications/run-checks` triggers a pass on demand.
- **System Config** — SLA hours / default reorder level / useful-life years / max login attempts editable at runtime (admin, audited), read live by the workflow / watchers / auth.
- **Replacement validation** — enforced in `requisitions.service.create()`.
- **Alternate approver** — planned-absence routing at submit + SLA-breach reassignment; supervisor self-service availability; admin designation panel.
- **Formal security e2e suite** (branch `chore/phase5-security-tests`, PR pending) — 8 ASVS scenarios end-to-end.

### Solid, all on `main`
- Auth: JWT + httpOnly refresh tokens, bcrypt, account lockout, RBAC guards, real login for all 7 roles — no mock accounts anywhere in the codebase anymore
- 7 roles: the original 5 (Employee, Supervisor, IT Personnel, System Admin, Management) plus Property Custodian and Property Officer, scoped to Fixed + Supplies assets
- Assets module: registry, lifecycle state machine, QR generation, search + status filter, asset-type scope enforcement on every write path (not just reads)
- Requisitions module: submit → approve/reject → fulfill workflow, real end to end as of 2026-08-19 — both the API and the actual UI (Supervisor's queue, the Approving Officer's real-time queue, and IT Personnel's fulfillment page all work against real data with real actions now, not just tested at the API level)
- Audit module: append-only log, action filter, per-record lookup — now including User Management (was the one module missing it; fixed 2026-08-19)
- Notifications module: in-system alerts, mark read, mark all read — **now auto-created** by the `scheduler` cron watchers (merged to `develop`, see §1)
- Users module: CRUD, role assignment, deactivate, reset password, unlock, search
- Reports module: real PDF (pdfkit) + Excel (exceljs), all 18 COA forms (generation mechanism is solid; several forms' *layout* diverges from the official template — see `docs/guides/COA-FORMS-AUDIT.md`)
- **The whole redesigned layout is wired now (2026-08-27, on `main`).** All 5 porting phases: IT Asset Custodian (every screen), Approving Officer (dashboard + queues + real actions), Property Custodian & Property Officer (dashboards, asset registries, QR, fulfillment/custody/disposal), Management & Audit Viewer (dashboard KPIs, all report tabs, forms archive, audit), Master Admin (Users/Roles/Audit + 2 of 6 dashboard panels), and a shared COA-forms generator. Screen-by-screen mock inventory: `MOCK-DATA-WIRING.md`.
- Asset registration: a real, reachable, working page now exists in navigation for IT Asset Custodian and Property Custodian
- Report generation, asset lifecycle updates, user creation, and role assignment — all previously *wired but silently broken* by uppercase-vs-lowercase-enum mismatches — fixed on `main`.

### Known-fake despite looking real — no backend exists yet (see `FEATURE-STATUS.md` 🔴 / `MOCK-DATA-WIRING.md` for the full list)
- Master Admin `reference-data` + governance pages (approval workflows, custodian coverage, master data, system health, org units, access reviews) — no backend at all; they honestly disclose "...in frontend mock state". (System Settings itself is now **real** — see §1 PR #87.)
- `physical-inventory` slugs, Property Officer corrections / reconciliation — no physical-count backend. (Replacement-validation backend now exists — PR #86 — but the standalone Property Officer `replacements` screen is still the mock list.)
- Employee "returns & incidents" and "assigned assets" — no returns/incidents module; assigned-assets needs a custodian filter on `GET /v1/assets`
- Two "Preview data"-labeled chart panels on the Management / Management&Audit dashboards

---

## 5. What Still Needs to Be Done

Don't duplicate the gap list here — **`PATH-TO-DONE.md`** (everything between here and CICC handover) and **`SYSTEM-STATUS.md`** (the plain-language gap list + suggested order) at the repo root are the maintained versions. Highlights as of this handoff:

| Priority | Item |
|---|---|
| ~~1~~ | ~~Notifications + SLA cron job~~ — **merged, PR #84** |
| ~~2~~ | ~~System-config backend~~ — **merged, PR #87** (Master Admin → System Settings) |
| ~~3~~ | ~~Replacement requisition validation~~ — **merged, PR #86** |
| 4 | Disposal workflow (currently just a status flag, no required fields) |
| 5 | Fix the 18 COA form templates against their references (`docs/guides/COA-FORMS-AUDIT.md`) |
| ~~6~~ | ~~Alternate approver designation~~ — **merged, PR #89 / #90** |
| 7 | Master Admin governance backend (access reviews, org units, approval config, custodian coverage, master data, system events) |
| 8 | Physical count / reconciliation workflow + 2 missing management reports |
| 9 | Small wiring leftovers (`MOCK-DATA-WIRING.md` Parts B–C) — mostly one-liners once the backends above exist |

Phase 5 (`docs/phases/PHASE-5-TESTING.md`): the **formal Jest security suite is done** (8 scenarios, branch `chore/phase5-security-tests`); JMeter load test, OWASP ZAP scan, and UAT with CICC are still open and are best run once the build above is functionally complete — see `PATH-TO-DONE.md` §C for the rationale. Tooling not yet added (Husky, MFA/TOTP, idle session timeout, Playwright e2e): `docs/guides/FUTURE-TOOLING.md`.

---

## 6. Key Files to Read (in this order)

| # | File | Why |
|---|---|---|
| 1 | **`CLAUDE.md`** | Single source of truth. Read every section before writing code. |
| 2 | **`FEATURE-STATUS.md`** | One-screen ✅ / 🟡 / 🔴 mock / ⬜ map of the whole system. |
| 3 | **`SYSTEM-STATUS.md`** | Plain-language gap list + suggested order of work. |
| 4 | **`PATH-TO-DONE.md`** | Everything between feature-complete and CICC handover, checklist form. |
| 5 | **`CHECKS.md`** | Run every check before marking any task done. Non-negotiable. |
| 6 | **`docs/guides/ROLES.md`** | Role descriptions, permissions, page routes. |
| 7 | **`docs/guides/SECURITY.md`** | Canonical security spec — wins over CLAUDE.md on security specifics if they ever disagree. |
| 8 | **`packages/shared/src/enums/index.ts`** | All shared enums (UserRole, AssetStatus, RequisitionStatus, etc.) — use these, never hardcode strings. |
| 9 | **`docs/phases/PHASE-5-TESTING.md`** | Testing & Evaluation phase guide (Jest security tests, ZAP, JMeter). |

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
- **Schema changes:** write a `.sql` file in `Database/schemas/` (or `Database/migrations/` for post-launch changes) and run it manually in the Supabase SQL Editor. `synchronize: false` means nothing happens automatically. Migrations through **`007_alternate_approver.sql`** are applied to dev Supabase as of 2026-08-30 (006 = system_config, 007 = alternate approver).
- **Production:** raw PostgreSQL managed by CICC IT. No Supabase SDK features in application code — see `Database/README.md`.
- The `user_role` enum includes `property_custodian` / `property_officer`; the `audit_action` enum now also has `system_config_updated` (migration 006) and `requisition_reassigned` (migration 007).

---

## 11. Docker Notes (read before you touch `docker-compose build`)

Two things worth knowing, found the hard way on 2026-08-19:

1. **There are two separate dependency trees in this repo.** Local dev, tests, and CI all install through the **root npm workspace** — `npm install`/`npm ci` at the repo root, which is what §2 above tells you to run. But `Backend/Dockerfile` and `Frontend/Dockerfile` each do their own **standalone** `COPY package*.json ./` + `npm ci`, using `Backend/package-lock.json` / `Frontend/package-lock.json` directly — completely separate from the root lockfile, and npm workspaces doesn't touch them. These two lockfiles can silently drift out of sync with their own `package.json` if nobody's actually building the Docker images regularly. If `docker-compose build` ever fails with `npm ci` complaining the lockfile is out of sync, that's why — regenerate the specific lockfile (`cd Backend && rm package-lock.json && npm install`, twice if the first pass doesn't round-trip cleanly through `npm ci`) rather than assuming something's wrong with your machine.
2. **If `npm ci` fails inside the container with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`** on every registry fetch: that's TLS interception on your network (proxy, antivirus, campus/office network filtering) whose root CA your Windows host trusts but the container's own minimal certificate store doesn't. Not a code problem — it'll happen on any machine behind that kind of network, regardless of what's in the lockfile. No fix from inside this repo; either build from a network without that interception, or add the intercepting CA to the image's trust store (out of scope for now, nobody's needed to build the actual container image day-to-day yet).

---

*For questions about the codebase, read CLAUDE.md first — most answers are there. For current gaps, read SYSTEM-STATUS.md.*
