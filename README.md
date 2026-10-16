# AIMRS — Asset Inventory Management and Requisition System

> **For:** Cybercrime Investigation and Coordinating Center (CICC)  
> **By:** Casambros · Montaniel · Ocampo · Valenton — UST CICS, Department of Information Systems  
> **Target Completion:** October 2026

A government-grade web platform implementing ITIL 4 ITAM practices, replacing CICC's manual paper-based asset management and requisition processes.

**Status (2026-10-16):** feature-complete for all six roles on real data (the frontend has no mock data). What is left is merging the open PR stack, the rest of the COA form fidelity, Phase 5 testing (JMeter, ZAP, UAT) and the production / handover work that waits on CICC. The one-screen map is [`FEATURE-STATUS.md`](./FEATURE-STATUS.md); the checklist to handover is [`PATH-TO-DONE.md`](./PATH-TO-DONE.md).

---

## Project Structure

```
cicc/
├── Backend/            ← NestJS 11 (TypeScript strict, REST API, RBAC, JWT, TypeORM)
│   ├── src/
│   │   ├── assets/         ← Asset registry, lifecycle, QR, repairs (Modules 1 and 7)
│   │   ├── asset-requests/ ← Returns & Incidents (Module 6)
│   │   ├── requisitions/   ← Requisition workflow (Module 2)
│   │   ├── auth/           ← Authentication, JWT, guards
│   │   ├── users/          ← User management (Admin only)
│   │   ├── notifications/  ← In-system alerts
│   │   ├── scheduler/      ← Cron watchers (SLA, nudges, overdue return / repair, low stock)
│   │   ├── system-config/  ← Runtime-tunable settings
│   │   ├── admin/          ← Master Admin dashboard statistics
│   │   ├── audit/          ← Append-only audit trail (COA compliance)
│   │   ├── reports/        ← PDF/Excel reports & the 18 COA forms
│   │   └── health/         ← GET /api/health
│   └── Dockerfile
├── Frontend/           ← Next.js 16 (React 19, TypeScript, App Router, Tailwind 4)
│   ├── app/            ← One workspace per role: employee, approving-officer, it-asset-custodian,
│   │                      property-custodian, master-admin, management-audit
│   └── Dockerfile
├── Database/           ← PostgreSQL schemas 001…017 and the dev seed
├── packages/
│   └── shared/         ← Shared TS types, enums, interfaces, constants
├── docs/               ← guides/ (ROLES, SECURITY, COA-FORMS-AUDIT, FUTURE-TOOLING), phases/
├── perf/               ← k6 load baseline
├── docker-compose.yml      ← Dev environment (Postgres + Backend + Frontend)
├── docker-compose.prod.yml ← Production (CICC-managed)
├── docker-compose.e2e.yml  ← Throwaway Postgres for the e2e suite
└── CLAUDE.md               ← Project intelligence file
```

## Documentation

Start with **`CLAUDE.md`** (rules, roles, modules, constraints), then:

| Read this | For |
|---|---|
| [`FEATURE-STATUS.md`](./FEATURE-STATUS.md) | what works today, on one screen |
| [`SYSTEM-STATUS.md`](./SYSTEM-STATUS.md) | the narrative: where things stand, what is still open, history |
| [`PATH-TO-DONE.md`](./PATH-TO-DONE.md) | everything between now and CICC handover |
| [`NEXT-TIME.md`](./NEXT-TIME.md) | where the last session stopped, and what to do next |
| [`TEAM-HANDOFF.md`](./TEAM-HANDOFF.md) | onboarding: branches, PR stack, accounts, what is built |
| [`RUN-LOCAL.md`](./RUN-LOCAL.md) | running it locally, troubleshooting, verifying screens and PDFs |
| [`CHECKS.md`](./CHECKS.md) | the quality gate every change must pass |
| [`docs/guides/ROLES.md`](./docs/guides/ROLES.md) | the six roles, permission matrix, routes, dev credentials |
| [`docs/guides/SECURITY.md`](./docs/guides/SECURITY.md) | the security contract |
| [`docs/guides/COA-FORMS-AUDIT.md`](./docs/guides/COA-FORMS-AUDIT.md) | how the 18 forms compare with the official templates |
| [`Database/README.md`](./Database/README.md) | the schema files and how to apply them |

CLAUDE.md §18 says which file to update when something changes.

## Quick Start (Docker — Recommended)

```bash
# 1. Clone and enter the project
cd cicc

# 2. Env — Backend/.env.example documents every var
cp Backend/.env.example Backend/.env       # fill in / adjust
# (the dev compose has sane defaults for everything but POSTGRES_PASSWORD)

# 3. Start everything (build context is the repo root — a workspaces monorepo)
docker compose up --build

# Frontend  → http://localhost:3000
# Backend   → http://localhost:3001/api   (health: /api/health)
# Postgres  → localhost:5432  (all Database/schemas/*.sql + the dev seed
#             applied on first boot; login: admin@cicc.gov.ph / ChangeMe@1234!)
```

## Quick Start (Without Docker)

```bash
# Install all workspace dependencies from root
npm install

# Both servers together, with hot reload (from the repo root)
npm run dev

# …or one at a time
cd Backend && npm run start:dev      # http://localhost:3001/api
cd Frontend && npm run dev           # http://localhost:3000
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript (App Router, Tailwind CSS 4) |
| Backend | NestJS 11 + TypeScript (REST, RBAC, JWT, TypeORM) |
| Database (Dev) | Supabase (managed PostgreSQL) |
| Database (Prod) | CICC-managed PostgreSQL (raw) |
| Containerization | Docker + Docker Compose |
| Testing | Jest (900 backend unit + 94 e2e on a real Postgres), vitest (494 frontend) — as of 2026-10-17 — plus a k6 baseline; JMeter is the formal run still to do |
| Report Generation | pdfkit (PDF) + exceljs (Excel/XLSX) |

## API Endpoints

Every route is role-guarded (CLAUDE.md §4 has the permission matrix). All under `/api/v1` unless noted.

| Module | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/auth` | POST /login, /refresh, /logout; GET /profile |
| Assets | `/assets` | GET (scoped by asset type), GET /mine, GET /catalogue, POST, PATCH /:id, PATCH /:id/lifecycle, POST /:id/qr |
| Requisitions | `/requisitions` | GET, GET /mine, POST, POST /:id/approve\|reject\|hold\|fulfill, GET /decided, GET /replacement-review, GET /fulfilment-fallback (System Admin), GET /:id/documents/:formId |
| Asset requests (Returns & Incidents) | `/asset-requests` | POST (multipart, up to 3 attachments), GET /mine, PATCH /:id/approve\|reject\|complete\|cancel, GET /:id/documents/:formId |
| Repairs | `/repairs` | GET, GET /asset/:assetId, PATCH /:id, POST /:id/loaner, POST /:id/complete |
| Users | `/users` | GET, POST, PATCH /:id/role\|deactivate\|activate\|unlock\|reset-password\|revoke-sessions, PATCH /me/availability |
| Notifications | `/notifications` | GET, PATCH /:id/read, PATCH /read-all, POST /run-checks, GET /watcher-status |
| Audit | `/audit` | GET (read-only; `action` + `startDate`/`endDate`), GET /user/:id, GET /record/:id (scoped) |
| System Config | `/system-config` | GET (with per-key `meta` provenance), PATCH (admin, audited) |
| Admin | `/admin` | GET /dashboard-stats (System Admin) |
| Reports | `/reports` | POST /generate, GET /forms, POST /forms/generate, GET /forms/:id/download, GET /kpi |
| Health | `/api/health` (no `/v1`) | GET (no auth — liveness + DB readiness) |

## Running Tests

```bash
# Unit tests (800)
cd Backend && npm run test

# E2E tests — needs Docker; spins a throwaway Postgres like CI's backend-e2e job
# (plain `npm run test:e2e` targets Supabase and won't connect from jest)
cd Backend && npm run test:e2e:local      # 94 tests

# Frontend (456)
cd Frontend && npm run test

# Coverage report (must meet thresholds — see CHECKS.md)
cd Backend && npm run test:cov
```

## Starting the Backend (Windows Note)

If `npm run start:dev` fails with `EADDRINUSE: address already in use :::3001`, a ghost node process is holding the port. Kill it first:

```powershell
# Find and kill the process holding port 3001
$pid = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force }
# Then retry
cd Backend && npm run start:dev
```

## Key Constraints

- **TypeScript strict mode** throughout — no plain JS files
- **NestJS enforces all RBAC** — frontend checks are UX only
- **Audit logs are append-only** — no UPDATE/DELETE on `audit_logs` table (COA compliance)
- **No Supabase SDK** in application code — production runs raw PostgreSQL
- **No PHP, no mobile app, no external integrations**

See [CLAUDE.md](./CLAUDE.md) for the complete project intelligence file.
