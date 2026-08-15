# AIMRS — Team Handoff Guide

> **For:** Nelson James Casambros · Andrei Fredrick Montaniel · Jairus Nathan Valenton  
> **From:** Jherome Luis Ocampo  
> **Date:** June 18, 2026  
> **Target Completion:** October 2026

Read this file first. Then read **CLAUDE.md**. Everything else is linked from there.

---

## 1. Which Branch to Clone

```bash
git clone <repo-url>
cd cicc
git checkout develop
```

**Always work off `develop`.** Never push directly to `main`.

Branch flow: `feature/<ticket-id>-<desc>` → `develop` → `main`

See CLAUDE.md §13 for the full branch strategy.

---

## 2. Local Setup

### Prerequisites

- Node.js 18+ (LTS)
- npm 9+
- Git

### Install dependencies

```bash
# From the project root — installs Frontend + Backend + shared package
npm install
```

### Environment files

**Backend — create `Backend/.env`:**

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=                 # ask Jherome for this value
JWT_SECRET=                   # ask Jherome for this value
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=           # ask Jherome for this value
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

**Frontend — create `Frontend/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Start the servers

Open two terminal windows:

```bash
# Terminal 1 — Backend
cd Backend
npm run start:dev
# Wait for: "Nest application successfully started"

# Terminal 2 — Frontend
cd Frontend
npm run dev
# Open: http://localhost:3000
```

> **Windows tip:** If you get `EADDRINUSE: address already in use :::3001`, a ghost process is holding the port. Run this in PowerShell:
> ```powershell
> $p = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess
> if ($p) { Stop-Process -Id $p -Force }
> ```
> Then retry `npm run start:dev`.

---

## 3. Test Login Credentials

| Role | Email | Password |
|---|---|---|
| System Administrator | admin@cicc.gov.ph | Admin@CICC2026! |
| IT Personnel | itpersonnel@cicc.gov.ph | CiccIT@2026!Sec |
| Supervisor | supervisor@cicc.gov.ph | Supervisor@CICC2026! |
| Employee | employee@cicc.gov.ph | Employee@CICC2026! |
| Management | management@cicc.gov.ph | Management@CICC2026! |

> If an account is locked (too many failed logins), the System Admin can unlock it:
> ```bash
> # 1. Login as admin, get token
> # 2. PATCH http://localhost:3001/api/v1/users/:id/unlock
> ```

Full role details and page routes: **`docs/guides/ROLES.md`**

---

## 4. What Has Been Built (as of June 18, 2026)

### Backend (NestJS — `Backend/src/`)

| Module | Status | Notes |
|---|---|---|
| Auth (`/auth`) | ✅ Done | JWT + httpOnly refresh tokens, bcrypt, account lockout, RBAC guards |
| Assets (`/assets`) | ✅ Done | Registry, lifecycle state machine, QR generation, search + status filter |
| Requisitions (`/requisitions`) | ✅ Done | Submit → approve → fulfill workflow, SLA deadline, stats |
| Audit (`/audit`) | ✅ Done | Append-only audit log, action filter, per-record lookup |
| Notifications (`/notifications`) | ✅ Done | In-system alerts, mark read, mark all read |
| Users (`/users`) | ✅ Done | CRUD, role assignment, deactivate, reset password, unlock, search |
| Reports (`/reports`) | ✅ Done | Real PDF (pdfkit) + Excel (exceljs) generation, 18 COA forms |

**Test coverage:** 91 unit tests passing, 65% branch coverage (threshold: 55%).

### Frontend (Next.js — `Frontend/app/`)

| Role Dashboard | Status |
|---|---|
| Employee (`/employee/`) | ✅ Done |
| Supervisor (`/supervisor/`) | ✅ Done |
| IT Personnel (`/it-personnel/`) | ✅ Done |
| System Administrator (`/admin/`) | ✅ Done |
| Management (`/management/`) | ✅ Done |
| Login page | ✅ Done |

---

## 5. What Still Needs to Be Done

These are the remaining tasks before the October 2026 handover. Pick one per sprint.

### Development (Jun – Aug 15, 2026)

| Task | Priority | Notes |
|---|---|---|
| SLA cron job | High | Auto-flag requisitions past 24-hour SLA; trigger SLA breach notification. No library exists — implement with `@nestjs/schedule`. |
| Management KPI dashboard — real data | High | `/management/dashboard` currently shows mock numbers. Wire it to `GET /api/v1/reports/kpi` which needs to query real DB stats (requisition lead time, SLA compliance rate, inventory accuracy). |
| Alternate approver designation | Medium | CLAUDE.md §6 — if primary supervisor unavailable, system routes to backup. Needs new DB field + UI in Admin config. |
| Physical count reconciliation | Medium | `RPCI` and `RPCPPE` forms need a manual count input workflow. |
| Frontend test suite | Medium | No Playwright/RTL tests yet. Add at least smoke tests for login + dashboard load for each role. Needed for SonarCloud frontend coverage. |
| Asset disposal workflow | Low | "Flagged for disposal" → document justification → confirm disposal. Currently only the flag exists. |

### Testing & Evaluation (Aug 16 – Sep 15, 2026)

| Task | Owner | Notes |
|---|---|---|
| JMeter stress test | All | 362 concurrent users. Run against test branch deployment. Scripts in `docs/` TBD. |
| OWASP ASVS security checklist | All | Go through ASVS level 2 checklist item by item. Document findings. |
| UAT with CICC stakeholders | All | Structured evaluation instrument. Roles: Employee, Supervisor, IT Personnel. |

### Deployment (Sep 16 – Oct 5, 2026)

| Task | Notes |
|---|---|
| GitHub Environments setup | Awaiting CICC server credentials. See CLAUDE.md §13. |
| Docker production image | `docker-compose.prod.yml` exists. Test against raw PostgreSQL (not Supabase). |
| SSL certificate | CICC IT manages this. |
| Production DB migrations | Run all files in `Database/migrations/` on the CICC PostgreSQL server. |

---

## 6. Key Files to Read (in this order)

| # | File | Why |
|---|---|---|
| 1 | **`CLAUDE.md`** | The single source of truth. Read every section before writing any code. |
| 2 | **`CHECKS.md`** | Run every check before marking any task done. Non-negotiable. |
| 3 | **`docs/guides/ROLES.md`** | Role descriptions, permissions, and page routes. |
| 4 | **`packages/shared/src/enums.ts`** | All shared enums (UserRole, AssetStatus, RequisitionStatus, etc.) — use these everywhere, never hardcode strings. |
| 5 | **`docs/phases/`** | Phase guides for backend testing, COA forms, frontend, security. |

---

## 7. Key Technical Rules (Do Not Break These)

These are the most important constraints from CLAUDE.md §11. Breaking them causes hard-to-debug failures:

1. **TypeScript strict mode only** — no plain JS, no `any` without justification.
2. **`synchronize: false` in TypeORM** — every entity change needs a SQL migration file. Never re-enable `synchronize: true`.
3. **Audit logs are append-only** — no UPDATE or DELETE on `audit_logs`. Non-negotiable for COA compliance.
4. **`pdfkit` must stay in webpack externals** — `Backend/webpack.config.js` has `pdfkit: 'commonjs pdfkit'`. Never remove it or PDF generation breaks silently.
5. **RBAC is enforced at the NestJS controller level** — every protected route must have `@Roles(...)` + `@UseGuards(JwtAuthGuard, RolesGuard)`. Frontend role checks are UX only.
6. **`AssetStatus` and `RequisitionStatus` enums are lowercase** — `'available'`, `'issued'`, `'pending_supervisor'`, etc. Never uppercase.
7. **Login DTO uses `emailOrEmployeeId`** — not `email`. The field accepts either format.
8. **One login call per test** — calling login twice for the same user invalidates all previous tokens (`tokenVersion` increments).

---

## 8. Git Workflow

```bash
# Start a new feature
git checkout develop
git pull origin develop
git checkout -b feature/AIMRS-<ticket>-<short-desc>

# Work, commit frequently
git add <specific files>
git commit -m "feat: describe what and why"

# Push and open PR to develop
git push -u origin feature/AIMRS-<ticket>-<short-desc>
# Open PR on GitHub → target branch: develop
```

**PR to `develop` requires:**
- 1 reviewer approval
- All CI checks green (TypeScript, ESLint, build, tests, coverage)

**Never push directly to `develop` or `main`.**

---

## 9. Running the Quality Checklist

Before opening any PR, run all checks in **`CHECKS.md`** in order. The fastest way:

```bash
# Tell Claude Code:
"Read CHECKS.md and run every check one by one. Fix any failure before moving to the next."
```

Or run manually — all 11 checks are in `CHECKS.md` with exact commands and pass conditions.

---

## 10. Database Notes

- **Dev database:** Supabase (credentials in `.env` above). Shared by the team — do not drop tables.
- **Schema changes:** Write a `.sql` migration file in `Database/migrations/` and run it manually in the Supabase SQL Editor.
- **Seed data:** 15 sample assets already seeded (see asset inventory when logged in as IT Personnel). Additional seeds are in `Database/seeds/`.
- **Production:** Raw PostgreSQL managed by CICC IT. No Supabase client features in application code.

---

*Last updated: June 18, 2026 by Jherome Ocampo*  
*For questions about the codebase, read CLAUDE.md first — most answers are there.*
