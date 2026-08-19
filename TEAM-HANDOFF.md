# AIMRS — Team Handoff Guide

> **For:** Nelson James Casambros · Andrei Fredrick Montaniel · Jairus Nathan Valenton
> **Target Completion:** October 2026
> **Last updated:** August 19, 2026

Read this file first, then **CLAUDE.md** (the single source of truth for the whole project). Everything else is linked from one of these two.

---

## 1. The Branch Situation Right Now (read this before you clone)

There are two branches that matter, and they are **not** at the same point:

| Branch | What it has |
|---|---|
| `FE-Updated-not-finished` | The 7-role frontend redesign (mock data), plus SonarCloud/security cleanup. This is the older of the two. |
| `feature/property-roles-and-backend-wiring` | Everything in `FE-Updated-not-finished`, **plus**: 2 new roles (Property Custodian, Property Officer) wired into the real backend, real login for all 7 roles (mock login code fully removed), several redesigned pages wired to real APIs instead of mock data, and a security fix-wave (write-side asset-type scoping, missing RBAC guards). Not yet merged anywhere. |

`feature/property-roles-and-backend-wiring` is a strict superset — every commit on `FE-Updated-not-finished` is already in it. Nothing has been lost or forked; the second branch just hasn't been merged back yet. **Check `git log --oneline -1` on whichever branch you're on before assuming what's "done" — don't rely on this file's section 4 alone, it describes both.**

If you don't know which one to build on: ask whoever's driving before starting new work. Building on the older branch means redoing work that already exists on the newer one.

For a fast, plain-language read of what's actually wired to the backend vs. still fake, see **`SYSTEM-STATUS.md`** at the repo root — kept up to date on the newer branch, current as of this handoff.

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

The `property_custodian` and `property_officer` roles **already exist in the shared dev database** (enum values added, 2 seed accounts created) even though the frontend/backend code for them only lives on `feature/property-roles-and-backend-wiring`. Ask a teammate for those 2 accounts' credentials if you're working on that branch — they're not written down here since the DB is shared infrastructure.

> If an account is locked (too many failed logins), a System Admin can unlock it: `PATCH /api/v1/users/:id/unlock`, or force a password reset: `PATCH /api/v1/users/:id/reset-password`.

Full role details and page routes: **`docs/guides/ROLES.md`**

---

## 4. What Has Been Built

### Solid, on both branches
- Auth: JWT + httpOnly refresh tokens, bcrypt, account lockout, RBAC guards
- Assets module: registry, lifecycle state machine, QR generation, search + status filter
- Requisitions module: submit → approve → fulfill workflow (tested at the API level), SLA deadline field, stats
- Audit module: append-only log, action filter, per-record lookup
- Notifications module: in-system alerts, mark read, mark all read (nothing auto-creates them yet — see gap list)
- Users module: CRUD, role assignment, deactivate, reset password, unlock, search
- Reports module: real PDF (pdfkit) + Excel (exceljs), all 18 COA forms
- 5-role frontend (Employee, Supervisor, IT Personnel, System Admin, Management) — original UI, all real

### Only on `feature/property-roles-and-backend-wiring` (unmerged)
- Property Custodian / Property Officer as real backend roles, scoped to Fixed + Supplies assets
- Asset-type scope enforcement added to every asset/requisition write path (not just reads)
- Real login wired for the 7-role redesigned frontend — no mock accounts anywhere anymore
- Employee's redesigned pages, Approving Officer's queue, and parts of Master Admin (Users/Roles/Audit) wired to real APIs

### Known-fake despite looking real (see `SYSTEM-STATUS.md` for the full list)
- Approving Officer's Approve/Reject buttons in the redesigned UI don't call the backend — local state only, reverts on refresh
- No reachable page that saves a newly registered asset to the database (the one that does isn't linked in navigation)
- Most of the redesigned dashboards are still mock data behind a real-looking UI

---

## 5. What Still Needs to Be Done

Don't duplicate the gap list here — **`SYSTEM-STATUS.md`** at the repo root is the maintained, current version of this. Read that for specifics and suggested order of work. Highlights as of this handoff:

| Priority | Item |
|---|---|
| 0 | Fix Approve/Reject buttons + the asset-registration dead end (see above — these look done, aren't) |
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
- The `user_role` Postgres enum currently includes `property_custodian` and `property_officer` in the shared dev DB, ahead of what most branches' code expects. This is expected and safe — extra enum values don't break code that doesn't reference them yet.

---

*For questions about the codebase, read CLAUDE.md first — most answers are there. For current gaps, read SYSTEM-STATUS.md.*
