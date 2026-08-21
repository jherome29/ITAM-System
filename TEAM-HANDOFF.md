# AIMRS — Team Handoff Guide

> **For:** Nelson James Casambros · Andrei Fredrick Montaniel · Jairus Nathan Valenton
> **Target Completion:** October 2026
> **Last updated:** August 19, 2026

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

**Open branch awaiting merge, 2026-08-21:** `fix/dead-ui-controls-and-logout-crash` (2 commits on top of `develop`) — found via a systematic re-audit (parallel agent sweep across every role's frontend + all 8 backend controllers) for the same class of bug as the branch name's first fix: real, wired features that are silently broken, either by dead UI controls or by uppercase-vs-real-lowercase-enum mismatches. Fixes: the logout button/endpoint (dead link + a `req.user.sub`-vs-`.id` backend crash), a notifications IDOR (any user could mark any other user's notification read), and ~10 more correctness bugs across report generation, asset lifecycle updates, user creation/role assignment, audit-trail filtering, notification icons, status badges, the Employee dashboard/notifications (were still mock, now real), and Master Admin's unbuilt pages (now honestly disclosed as mock instead of implying they saved). Full list and rationale in the two commit messages. Pull this in before doing further work in any of those areas.

For a fast, plain-language read of what's actually wired to the backend vs. still fake, see **`SYSTEM-STATUS.md`** at the repo root.

---

## 2. Local Setup

### Prerequisites
- Node.js 18+ (LTS), npm 9+, Git

### Install dependencies
```bash
# From the project root — installs Frontend + Backend + packages/shared
npm install
```

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

> **TLS error connecting to Supabase (`self-signed certificate in certificate chain`):** this happens on some machines/networks. `Backend/src/app.module.ts` sets `ssl.rejectUnauthorized: true` by design — do not commit it as `false`. If you hit this locally, it's fine to flip it to `false` **temporarily and locally only** to keep working, and revert before committing. Ask a teammate if you're not sure why this is strict.

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

### Solid, all on `main`
- Auth: JWT + httpOnly refresh tokens, bcrypt, account lockout, RBAC guards, real login for all 7 roles — no mock accounts anywhere in the codebase anymore
- 7 roles: the original 5 (Employee, Supervisor, IT Personnel, System Admin, Management) plus Property Custodian and Property Officer, scoped to Fixed + Supplies assets
- Assets module: registry, lifecycle state machine, QR generation, search + status filter, asset-type scope enforcement on every write path (not just reads)
- Requisitions module: submit → approve/reject → fulfill workflow, real end to end as of 2026-08-19 — both the API and the actual UI (Supervisor's queue, the Approving Officer's real-time queue, and IT Personnel's fulfillment page all work against real data with real actions now, not just tested at the API level)
- Audit module: append-only log, action filter, per-record lookup — now including User Management (was the one module missing it; fixed 2026-08-19)
- Notifications module: in-system alerts, mark read, mark all read (nothing auto-creates them yet — see gap list)
- Users module: CRUD, role assignment, deactivate, reset password, unlock, search
- Reports module: real PDF (pdfkit) + Excel (exceljs), all 18 COA forms (generation mechanism is solid; several forms' *layout* diverges from the official template — see `docs/guides/COA-FORMS-AUDIT.md`)
- Employee's redesigned pages (dashboard included, as of 2026-08-21 — was the last mock-only Employee page), the Approving Officer's queue (including real actions now), and parts of Master Admin (Users/Roles/Audit) wired to real APIs instead of mock data
- Asset registration: a real, reachable, working page now exists in navigation for IT Asset Custodian and Property Custodian
- As of 2026-08-21: report generation, IT Personnel's asset lifecycle update button, user creation, and role assignment were all found *wired to the real API but silently broken* by uppercase-vs-real-lowercase-enum mismatches (`packages/shared/src/enums` is all lowercase) — every one of these previously failed or 400'd despite looking functional. Fixed; see `fix/dead-ui-controls-and-logout-crash`.

### Known-fake despite looking real (see `SYSTEM-STATUS.md` for the full list)
- `/admin/config` ("System Configuration") is a complete facade — no API call at all, false-success message, no backend endpoint exists yet to wire it to
- The Management dashboard mixes real KPIs with two hardcoded, unlabeled mock chart panels
- Master Admin's governance/platform pages (approval workflows, custodian assignments, master data, system health, org units, access reviews) have no backend to wire to at all — as of 2026-08-21 they honestly disclose "...in frontend mock state" instead of implying the action persisted (previously they didn't disclose this)
- IT Asset Custodian's and the two Property roles' own registry/dashboard screens — still mostly mock, tracked separately

---

## 5. What Still Needs to Be Done

Don't duplicate the gap list here — **`SYSTEM-STATUS.md`** at the repo root is the maintained, current version of this. Read that for specifics and suggested order of work. Highlights as of this handoff:

| Priority | Item |
|---|---|
| 0 | Fix `/admin/config`'s false-success message — needs a new backend config endpoint, not just wiring |
| 1 | Notifications + SLA cron job — nothing watches for alert conditions yet |
| 2 | Replacement requisition validation (useful-life / condition / loss-damage) |
| 3 | Disposal workflow (currently just a status flag, no required fields) |
| 4 | Alternate approver designation |
| 5 | Wire the rest of the redesigned pages to real APIs |
| 6 | Physical count/reconciliation workflow + 2 missing management reports |

Also still open regardless of branch: JMeter load test, OWASP ZAP scan, UAT with CICC — see `docs/phases/PHASE-5-TESTING.md`. Tooling not yet added (Husky pre-commit hooks, MFA/TOTP, idle session timeout, Playwright e2e) is tracked in `docs/guides/FUTURE-TOOLING.md` with trigger points for when to add each.

---

## 6. Key Files to Read (in this order)

| # | File | Why |
|---|---|---|
| 1 | **`CLAUDE.md`** | Single source of truth. Read every section before writing code. |
| 2 | **`SYSTEM-STATUS.md`** | Fast-read current gap list — what's real vs. still fake. |
| 3 | **`CHECKS.md`** | Run every check before marking any task done. Non-negotiable. |
| 4 | **`docs/guides/ROLES.md`** | Role descriptions, permissions, page routes. |
| 5 | **`docs/guides/SECURITY.md`** | Canonical security spec — wins over CLAUDE.md on security specifics if they ever disagree. |
| 6 | **`packages/shared/src/enums/index.ts`** | All shared enums (UserRole, AssetStatus, RequisitionStatus, etc.) — use these, never hardcode strings. |
| 7 | **`docs/phases/PHASE-5-TESTING.md`** | Testing & Evaluation phase guide (Jest security tests, ZAP, JMeter). |

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
- **Schema changes:** write a `.sql` file in `Database/schemas/` (or `Database/migrations/` for post-launch changes) and run it manually in the Supabase SQL Editor. `synchronize: false` means nothing happens automatically.
- **Production:** raw PostgreSQL managed by CICC IT. No Supabase SDK features in application code — see `Database/README.md`.
- The `user_role` Postgres enum includes `property_custodian` and `property_officer`, matching the code now merged into `main`.

---

## 11. Docker Notes (read before you touch `docker-compose build`)

Two things worth knowing, found the hard way on 2026-08-19:

1. **There are two separate dependency trees in this repo.** Local dev, tests, and CI all install through the **root npm workspace** — `npm install`/`npm ci` at the repo root, which is what §2 above tells you to run. But `Backend/Dockerfile` and `Frontend/Dockerfile` each do their own **standalone** `COPY package*.json ./` + `npm ci`, using `Backend/package-lock.json` / `Frontend/package-lock.json` directly — completely separate from the root lockfile, and npm workspaces doesn't touch them. These two lockfiles can silently drift out of sync with their own `package.json` if nobody's actually building the Docker images regularly. If `docker-compose build` ever fails with `npm ci` complaining the lockfile is out of sync, that's why — regenerate the specific lockfile (`cd Backend && rm package-lock.json && npm install`, twice if the first pass doesn't round-trip cleanly through `npm ci`) rather than assuming something's wrong with your machine.
2. **If `npm ci` fails inside the container with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`** on every registry fetch: that's TLS interception on your network (proxy, antivirus, campus/office network filtering) whose root CA your Windows host trusts but the container's own minimal certificate store doesn't. Not a code problem — it'll happen on any machine behind that kind of network, regardless of what's in the lockfile. No fix from inside this repo; either build from a network without that interception, or add the intercepting CA to the image's trust store (out of scope for now, nobody's needed to build the actual container image day-to-day yet).

---

*For questions about the codebase, read CLAUDE.md first — most answers are there. For current gaps, read SYSTEM-STATUS.md.*
