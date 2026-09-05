# AIMRS — Asset Inventory Management and Requisition System

> **For:** Cybercrime Investigation and Coordinating Center (CICC)  
> **By:** Casambros · Montaniel · Ocampo · Valenton — UST CICS, Department of Information Systems  
> **Target Completion:** October 2026

A government-grade web platform implementing ITIL 4 ITAM practices, replacing CICC's manual paper-based asset management and requisition processes.

---

## Project Structure

```
cicc/
├── Backend/            ← NestJS (TypeScript strict, REST API, RBAC, JWT)
│   ├── src/
│   │   ├── assets/         ← Asset registry & lifecycle (Module 1)
│   │   ├── requisitions/   ← Requisition workflow (Module 2)
│   │   ├── auth/           ← Authentication, JWT, guards
│   │   ├── users/          ← User management (Admin only)
│   │   ├── notifications/  ← In-system alerts
│   │   ├── audit/          ← Append-only audit trail (COA compliance)
│   │   └── reports/        ← PDF/Excel reports & COA forms
│   └── Dockerfile
├── Frontend/           ← Next.js 15 (TypeScript, App Router, Tailwind CSS)
│   ├── app/            ← Route groups per role (employee, supervisor, it-personnel…)
│   └── Dockerfile
├── Database/           ← PostgreSQL schemas, migrations, seeds
│   ├── schemas/
│   └── seeds/
├── packages/
│   └── shared/         ← Shared TS types, enums, interfaces, constants
├── docker-compose.yml      ← Dev environment (Postgres + Backend + Frontend)
├── docker-compose.prod.yml ← Production (CICC-managed)
└── CLAUDE.md               ← Project intelligence file
```

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

# Terminal 1 — Backend
cd Backend && npm run start:dev

# Terminal 2 — Frontend
cd Frontend && npm run dev
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + TypeScript (App Router, Tailwind CSS) |
| Backend | NestJS + TypeScript (REST, RBAC, JWT, TypeORM) |
| Database (Dev) | Supabase (managed PostgreSQL) |
| Database (Prod) | CICC-managed PostgreSQL (raw) |
| Containerization | Docker + Docker Compose |
| Testing | Jest (170 backend tests + 23 frontend tests, as of 2026-08-21) + JMeter |
| Report Generation | pdfkit (PDF) + exceljs (Excel/XLSX) |

## API Endpoints

| Module | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/api/v1/auth` | POST /login |
| Assets | `/api/v1/assets` | GET, POST, PATCH /:id/lifecycle, POST /:id/qr |
| Requisitions | `/api/v1/requisitions` | GET, POST, POST /:id/approve\|reject\|fulfill |
| Users | `/api/v1/users` | GET, POST, PATCH /:id/role\|deactivate\|activate\|unlock\|reset-password |
| Notifications | `/api/v1/notifications` | GET, PATCH /read-all |
| Audit | `/api/v1/audit` | GET (read-only) |
| Health | `/api/health` | GET (no auth — liveness + DB readiness) |
| Reports | `/api/v1/reports` | POST /generate, POST /forms/generate |

## Running Tests

```bash
# Unit tests
cd Backend && npm run test

# E2E tests — needs Docker; spins a throwaway Postgres like CI's backend-e2e job
# (plain `npm run test:e2e` targets Supabase and won't connect from jest)
cd Backend && npm run test:e2e:local

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
