# AIMRS — Session Handoff
**Last updated:** 2026-06-15 (Session 8)
**Read before starting any session:** `CLAUDE.md` → `ROLES.md` → `CHECKS.md` → this file

---

## Current State (as of Session 9)

| Area | Status |
|---|---|
| Backend — all API endpoints | ✅ Working |
| Security controls (OWASP, helmet, CORS, rate-limit, throttle) | ✅ Applied |
| All 18 COA form PDFs (pdfkit) | ✅ Generated and stored in DB |
| PDF re-download endpoint | ✅ `GET /api/v1/reports/forms/:id/download` |
| Admin: reset-password + unlock endpoints | ✅ Working |
| Login → dashboard flow (all 5 roles) | ✅ Working end-to-end |
| Frontend pages (most role pages) | ✅ Scaffolded + working |
| IT Personnel forms page + history panel | ✅ Working |
| IT Personnel asset detail `/it-personnel/assets/[id]` | ✅ Complete (Session 9) |
| CLAUDE.md | ✅ Updated (Session 8) |
| ROLES.md / CHECKS.md | ✅ Created |
| Test coverage | ⚠️ ~47.9% — target 70% (`reports.service.ts` at 0%) |
| SLA cron job | ❌ Not built |
| Management KPI charts | ❌ Not built |

---

## Pending Tasks (Next Sessions)

1. **Raise test coverage to 70%** — `reports.service.ts` has 0% coverage; it's the main gap. Add `Backend/src/reports/reports.service.spec.ts`.
2. **SLA cron job** — scheduled task (every hour) to check `PENDING_SUPERVISOR` requisitions past `slaDeadline` → fire `SLA_BREACH` notification.
3. **Management KPI dashboard charts** — visual charts on `/management/dashboard` (recharts).

---

## How to Run

```bash
# From project root: c:\Users\ocamp\OneDrive\Desktop\cicc
npm install           # install all workspaces

# Backend → http://localhost:3001/api
cd Backend && npm run start:dev

# Frontend → http://localhost:3000
cd Frontend && npm run dev
```

If `EADDRINUSE :::3001` — kill all node.exe in Task Manager, then retry.

---

## Test Credentials

See `ROLES.md` for full details. Quick reference:

| Role | Email | Password |
|---|---|---|
| System Admin | `admin@cicc.gov.ph` | `Admin@CICC2026!` |
| Employee | `employee@cicc.gov.ph` | `Employee@CICC2026!` |
| Supervisor | `supervisor@cicc.gov.ph` | `Supervisor@CICC2026!` |
| IT Personnel | `itpersonnel@cicc.gov.ph` | `CiccIT@2026!Sec` |
| Management | `management@cicc.gov.ph` | `Management@CICC2026!` |

> IT Personnel password was changed via `reset-password` endpoint after account lockout.

---

## All API Endpoints

| Module | Method | Route | Roles |
|---|---|---|---|
| **Auth** | POST | `/api/v1/auth/login` | Public |
| | POST | `/api/v1/auth/refresh` | Public (httpOnly cookie) |
| | POST | `/api/v1/auth/logout` | All |
| | GET | `/api/v1/auth/profile` | All |
| **Assets** | GET | `/api/v1/assets` | IT, Admin, Mgmt |
| | GET | `/api/v1/assets/stats` | IT, Admin, Mgmt |
| | GET | `/api/v1/assets/catalogue` | All |
| | GET | `/api/v1/assets/:id` | IT, Admin, Mgmt |
| | POST | `/api/v1/assets` | IT |
| | PATCH | `/api/v1/assets/:id` | IT |
| | PATCH | `/api/v1/assets/:id/lifecycle` | IT |
| | POST | `/api/v1/assets/:id/qr` | IT |
| **Requisitions** | GET | `/api/v1/requisitions` | All (role-filtered) |
| | GET | `/api/v1/requisitions/mine` | All |
| | GET | `/api/v1/requisitions/stats` | All |
| | GET | `/api/v1/requisitions/:id` | All |
| | POST | `/api/v1/requisitions` | Emp, Sup, IT |
| | POST | `/api/v1/requisitions/:id/approve` | Supervisor |
| | POST | `/api/v1/requisitions/:id/reject` | Supervisor |
| | POST | `/api/v1/requisitions/:id/hold` | IT |
| | POST | `/api/v1/requisitions/:id/fulfill` | IT |
| **Users** | GET | `/api/v1/users` | Admin, Mgmt |
| | POST | `/api/v1/users` | Admin |
| | GET | `/api/v1/users/:id` | Admin, Mgmt |
| | PATCH | `/api/v1/users/:id` | Admin |
| | PATCH | `/api/v1/users/:id/role` | Admin |
| | PATCH | `/api/v1/users/:id/deactivate` | Admin |
| | PATCH | `/api/v1/users/:id/reset-password` | Admin |
| | PATCH | `/api/v1/users/:id/unlock` | Admin |
| **Notifications** | GET | `/api/v1/notifications` | All |
| | PATCH | `/api/v1/notifications/:id/read` | All |
| | PATCH | `/api/v1/notifications/read-all` | All |
| **Audit** | GET | `/api/v1/audit` | Admin, Mgmt |
| | GET | `/api/v1/audit/user/:userId` | Admin |
| | GET | `/api/v1/audit/record/:recordId` | Admin, Mgmt, IT |
| **Reports** | GET | `/api/v1/reports` | IT, Admin, Mgmt |
| | POST | `/api/v1/reports/generate` | IT, Admin, Mgmt |
| | GET | `/api/v1/reports/kpi` | Mgmt, Admin |
| | GET | `/api/v1/reports/forms` | IT, Admin, Mgmt |
| | POST | `/api/v1/reports/forms/generate` | IT, Admin |
| | GET | `/api/v1/reports/forms/:id/download` | IT, Admin, Mgmt |

---

## Shared Enums (`packages/shared/src/enums/index.ts`)

```
UserRole:          EMPLOYEE | SUPERVISOR | IT_PERSONNEL | MANAGEMENT | SYSTEM_ADMIN
AssetStatus:       REGISTERED | AVAILABLE | ISSUED | RETURNED | TRANSFERRED |
                   UNDER_REPAIR | FLAGGED_FOR_DISPOSAL | DISPOSED
AssetClass:        PPE | SEMI_EXPENDABLE | EXPENDABLE
AssetCondition:    SERVICEABLE | UNSERVICEABLE | FOR_DISPOSAL | FOR_REPAIR
RequisitionStatus: DRAFT | PENDING_SUPERVISOR | PENDING_FULFILLMENT |
                   ON_HOLD | FULFILLED | REJECTED | CANCELLED
RequisitionType:   NEW | REPLACEMENT | REPAIR | TRANSFER
AuditAction:       ASSET_CREATED | ASSET_UPDATED | ASSET_ISSUED | ASSET_RETURNED |
                   ASSET_TRANSFERRED | ASSET_FLAGGED_REPAIR | ASSET_FLAGGED_DISPOSAL |
                   ASSET_DISPOSED | QR_GENERATED |
                   REQUISITION_SUBMITTED | REQUISITION_APPROVED | REQUISITION_REJECTED |
                   REQUISITION_ON_HOLD | REQUISITION_FULFILLED |
                   USER_CREATED | USER_UPDATED | USER_DEACTIVATED | USER_ROLE_CHANGED |
                   USER_LOGIN | USER_LOGOUT | USER_LOGIN_FAILED | USER_LOCKED |
                   REPORT_GENERATED | FORM_GENERATED
OfficialFormType:  PAR | ICS | RIS | PTR | IIRUP | RLSDDP | STICKER_CARD |
                   RECEIPT_RETURNED_PROPERTY | RECEIPT_RETURNED_SEP | IAR |
                   MOVE_IN | MOVE_OUT | RSMI | RSPI | RPCI | RPCPPE | WMR | ANNEX_A4
```

### Asset State Machine

```
REGISTERED → AVAILABLE
AVAILABLE  → ISSUED | TRANSFERRED | UNDER_REPAIR | FLAGGED_FOR_DISPOSAL
ISSUED     → RETURNED | UNDER_REPAIR | FLAGGED_FOR_DISPOSAL
RETURNED   → AVAILABLE | UNDER_REPAIR
TRANSFERRED → AVAILABLE
UNDER_REPAIR → AVAILABLE | FLAGGED_FOR_DISPOSAL
FLAGGED_FOR_DISPOSAL → DISPOSED
DISPOSED   → (terminal)
```

### Requisition Flow

```
Employee submits    → PENDING_SUPERVISOR  (notifies supervisor)
Supervisor approves → PENDING_FULFILLMENT (notifies IT + requester)
Supervisor rejects  → REJECTED            (notifies requester)
IT holds            → ON_HOLD             (notifies requester)
IT fulfills         → FULFILLED           (notifies requester)
SLA: PENDING_SUPERVISOR > 24h → SLA_BREACH notification
```

---

## Key Technical Constraints

> Most constraints now live in `CLAUDE.md §11` and `§16`. This section only lists things not covered there.

- **Import paths from `Backend/src/<module>/`:** `../../../packages/shared/src/...` (3 levels up)
- **Import paths from `Backend/src/<module>/<subdir>/`:** `../../../../packages/shared/src/...` (4 levels)
- **forwardRef()** in `RequisitionsModule` ↔ `UsersModule` — needed to break circular dependency
- **ThrottlerGuard is APP_GUARD in AppModule** — do NOT add it again in any feature module
- **AuditModule is imported by AuthModule** — do not create a back-reference (circular dep)
- **`crypto.randomUUID()`** from Node built-in — NOT the `uuid` npm package (pure ESM, breaks Jest)
- **No hard deletion anywhere** — users are deactivated (`isActive: false`); assets reach `DISPOSED`
- **`@JoinColumn({ name: '...' })`** with explicit name bypasses SnakeNamingStrategy — must be provided as snake_case manually
- **`pdfContent` column uses `select: false`** — `findOne()` returns `null` for it; use `createQueryBuilder` with explicit `.select(['f.pdfContent', ...])` to load the blob
- **Token refresh flow:**
  - Login: `POST /auth/login` → body has `accessToken`, sets httpOnly cookie `refresh_token`
  - Refresh: `POST /auth/refresh` (no header; uses cookie) → new `accessToken`, rotates cookie
  - Logout: `POST /auth/logout` (Bearer header) → clears cookie + DB hash
- **Frontend auth:** Access token stored in memory (React context) only. `AuthProvider` uses raw `axios` (not the intercepted client) for the initial session-check refresh on page load — so a missing cookie is silently swallowed and does not fire `onTokenExpired`.

---

## Session History (condensed)

| Session | Date | What happened |
|---|---|---|
| 1–2 | 2026-06-12 | Backend scaffolded: all modules, entities, services, guards, DTOs |
| 3 | 2026-06-13 | Security hardening: helmet, CORS, rate-limit, refresh tokens, audit trigger, secretlint |
| 4 | 2026-06-14 | SnakeNamingStrategy added (fixed camelCase→snake_case column mismatch); login working E2E |
| 5 | 2026-06-14 | Turbopack root fix (broke `router.push`); proxy.ts middleware fixed; admin dashboard renders |
| 6 | 2026-06-14 | All 18 COA form PDFs implemented with pdfkit; forms page + blob download working |
| 7 | 2026-06-14 | pdfkit webpack externalized (ENOENT fix); forms stored as bytea in DB; re-download endpoint; reset-password + unlock admin endpoints; form history panel on forms page; ROLES.md + CHECKS.md created |
| 8 | 2026-06-15 | CLAUDE.md updated: directory structure, five roles, role matrix, §11 technical decisions (pdfkit, bytea, admin endpoints, SnakeNamingStrategy, synchronize:false, @IsEnum), §16 code standards |
| 9 | 2026-06-15 | IT Personnel asset detail page complete: edit mode (PATCH endpoint + inline form), context-aware lifecycle modal (Employee ID for ISSUED, To Location for TRANSFERRED, required notes for disposal), form suggestion banner post-transition, transaction history panel from audit API |
