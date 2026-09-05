# AIMRS — Asset Inventory Management and Requisition System
## CLAUDE.md — Project Intelligence File

> **For:** Cybercrime Investigation and Coordinating Center (CICC)
> **Academic Institution:** University of Santo Tomas, College of Information and Computing Sciences, Department of Information Systems
> **Capstone Group:** Casambros, Nelson James · Montaniel, Andrei Fredrick · Ocampo, Jherome Luis · Valenton, Jairus Nathan
> **Adviser:** Asst. Prof. Arne B. Barcelo, PhD
> **Target Completion:** October 2026

---

## 1. Project Overview

The **Asset Inventory Management and Requisition System (AIMRS)** is a web-based, government-grade internal platform built for the CICC to replace their manual paper-based and spreadsheet-dependent asset management and employee requisition processes.

The system is not simply a CRUD application — it is a **digital implementation of the ITIL 4 IT Asset Management (ITAM) practice**, structured through the **ITIL 4 Service Value Chain (SVC)**, and hardened by **Security by Design** principles in compliance with the Philippine Data Privacy Act of 2012 (RA 10173) and NPC Circular No. 2023-06.

**The CICC context:**
- ~362 personnel across ~32 operational sections
- ~2,000 tracked assets at its central facility
- Operates as a law enforcement coordination body under DICT
- Handles sensitive government data — security and auditability are mission-critical

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js (TypeScript) | App Router, SSR/SSG where appropriate |
| **Backend** | NestJS (TypeScript) | Microservices-oriented, REST API |
| **Database (Dev/Test)** | Supabase (managed PostgreSQL) | Temporary — dev lifecycle only |
| **Database (Production)** | PostgreSQL (CICC-managed) | MySQL as fallback per CICC IT |
| **Containerization** | Docker | Standardizes all environments |
| **Testing** | Jest | Unit + integration; 70% coverage minimum |
| **Performance Testing** | Apache JMeter | Simulates 362 concurrent users |
| **Security Standard** | OWASP ASVS | Application Security Verification Standard |
| **Methodology** | Agile Scrum | 2-week sprints, feature-branch Git workflow |

**Key architectural principle:** Both frontend and backend are Node.js/TypeScript ecosystem — consistent patterns, shared tooling, compatible test frameworks. No PHP.

---

## 3. Architecture

### 3.1 System Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    CICC Internal Network                  │
│                                                           │
│   ┌──────────────┐        ┌──────────────────────────┐   │
│   │   Next.js    │◄──────►│        NestJS            │   │
│   │  (Frontend)  │  REST  │  (Backend API Gateway)   │   │
│   └──────────────┘        └──────────────────────────┘   │
│                                    │                      │
│                    ┌───────────────┼───────────────┐      │
│                    ▼               ▼               ▼      │
│             ┌─────────┐   ┌─────────────┐  ┌──────────┐  │
│             │  Asset  │   │ Requisition │  │  Auth &  │  │
│             │ Service │   │   Service   │  │  Audit   │  │
│             └─────────┘   └─────────────┘  └──────────┘  │
│                    │               │               │      │
│                    └───────────────┴───────────────┘      │
│                                    │                      │
│                           ┌────────────────┐             │
│                           │  PostgreSQL DB  │             │
│                           └────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Microservices Breakdown

Each service has defined API endpoints, is independently deployable, and does not affect other services when updated.

| Service | Responsibilities |
|---|---|
| **Asset Service** | Asset registration, lifecycle tracking, QR/barcode generation, status transitions |
| **Requisition Service** | Request submission, approval routing, multi-level workflow, status tracking |
| **Auth Service** | Login, JWT/session management, RBAC enforcement, password policies |
| **Audit Service** | Immutable audit trail logging for all system transactions, IP logging |
| **Notification Service** | Alerts for low-stock, overdue returns, pending approvals, SLA breaches |
| **Report Service** | Generation of PDF/Excel reports and COA-compliant official forms |

### 3.3 Directory Structure (Actual)

```
cicc/
├── Frontend/                   # Next.js frontend
│   ├── app/                    # App Router pages
│   │   ├── (auth)/             # Login page (public)
│   │   ├── employee/           # Employee role pages
│   │   ├── supervisor/         # Supervisor role pages
│   │   ├── it-personnel/       # IT Personnel role pages
│   │   ├── admin/              # System Administrator pages
│   │   └── management/         # Management/read-only pages
│   ├── components/             # Shared UI components
│   ├── lib/                    # Utilities, API clients, hooks
│   └── public/                 # Static assets (logo.png, etc.)
├── Backend/                    # NestJS backend
│   ├── src/
│   │   ├── assets/             # Asset module
│   │   ├── requisitions/       # Requisition module
│   │   ├── auth/               # Auth module (RBAC, JWT)
│   │   ├── audit/              # Audit trail module
│   │   ├── notifications/      # Alert module
│   │   ├── reports/            # Report generation + COA form generators
│   │   │   └── forms/          # 18 individual COA form generator files
│   │   └── users/              # User account management
│   ├── test/                   # Jest unit & integration tests
│   └── webpack.config.js       # Custom webpack (pdfkit externalized, TypeORM drivers ignored)
├── packages/
│   └── shared/                 # Shared TypeScript types/enums (OfficialFormType, UserRole, etc.)
├── Database/
│   ├── migrations/             # SQL migration scripts
│   └── seeds/                  # Dev seed data
├── FORMS/                      # Reference copies of official COA form templates
├── docker-compose.yml          # Dev environment
├── docker-compose.prod.yml     # Production (CICC-managed)
├── CLAUDE.md                   # ← This file
├── CHECKS.md                   # Pre-task quality checklist (TypeScript, ESLint, build, tests)
└── ROLES.md                    # Role permissions and test credentials reference
```

---

## 4. User Roles & Access Control (RBAC)

There are **five user roles** with strictly differentiated permissions. Every API endpoint must enforce role-based guards at the NestJS controller level. The frontend renders only functions permitted for the active user's role.

### Role Matrix

| Feature | Employee | Supervisor | IT Personnel | System Admin | Management |
|---|:---:|:---:|:---:|:---:|:---:|
| Login | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit requisition | ✓ | ✓ | ✓ | — | — |
| Track own request status | ✓ | ✓ | ✓ | — | — |
| View asset catalogue | ✓ | ✓ | ✓ | — | — |
| Receive notifications | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approve/reject requisitions | — | ✓ | — | ✓ | — |
| Approval history view | — | ✓ | ✓ | ✓ | ✓ |
| Register new assets | — | — | ✓ | — | — |
| Edit asset details (non-status fields) | — | — | ✓ | — | — |
| Update asset lifecycle | — | — | ✓ | — | — |
| Generate QR/barcodes | — | — | ✓ | — | — |
| Scan QR/barcodes | — | — | ✓ | — | — |
| Issue / return / transfer assets | — | — | ✓ | — | — |
| Flag assets for repair/disposal | — | — | ✓ | — | — |
| View asset transaction history | — | — | ✓ | ✓ | ✓ |
| Generate official forms (PAR, ICS, RIS…) | — | — | ✓ | ✓ | — |
| View all inventory dashboard | — | — | ✓ | ✓ | ✓ |
| User account management | — | — | — | ✓ | — |
| Role assignment | — | — | — | ✓ | — |
| View full audit trail (all records) | — | — | — | ✓ | ✓ |
| System configuration | — | — | — | ✓ | — |
| Generate management reports | — | — | ✓ | ✓ | ✓ |

### Role Notes
- **Employee** — Service requester. Can submit requisitions, browse catalogue, track own requests.
- **Supervisor** — First-level approver. Reviews and approves/rejects requests from their section.
- **IT Personnel** — Asset custodian. Manages the entire asset registry, lifecycle, QR/barcodes, issuance, returns, transfers, repairs, and forms. The primary operational role.
- **System Administrator** — Full system access. Manages user accounts, role assignments, audit trail, and system configuration.
- **Management** — Read-only oversight. Accesses dashboards, reports, and audit trails for monitoring and audit-readiness.

> **Security principle:** Principle of Least Privilege. Users access only what their role explicitly requires. Role-guard decorators must be applied on every protected NestJS route.

---

## 5. Asset Data Model

### 5.1 Asset Classification (CICC Framework)

| Class | Code | Definition |
|---|---|---|
| Property, Plant & Equipment | PPE | Useful life > 1 year, acquisition cost ≥ ₱50,000 |
| Semi-Expendable Property | SEP | Useful life > 1 year, acquisition cost < ₱50,000 |
| Inventory / Expendable Supplies | IES | Consumables, < 1 year useful life, low-cost items |

### 5.2 Asset Types in Scope

**ICT Assets:** desktop computers, monitors, CPUs, laptops, servers, UPS units, printers, scanners, network devices, storage devices, peripherals (keyboards, mice, headsets, headphones), communication devices, forensic workstations, Faraday boxes, specialized digital forensic equipment, software licenses/subscriptions (enterprise office suites, investigative tools)

**Fixed Assets:** office furniture, photocopying/duplicating machines, televisions, air conditioning units, communication equipment, service vehicles

**Office Supplies:** consumable items issued to personnel in daily operations

### 5.3 Required Asset Fields (from CICC official property records)

Every registered asset MUST capture all of the following:

```typescript
interface Asset {
  id: string;                    // System-generated UUID
  sapClassification: string;     // SAP classification code
  itemCode: string;              // Official item code
  itemDescription: string;       // Full item description
  brand: string;
  serialNumber: string;
  propertyNumber: string;        // Official CICC property number
  components: string;            // Attached components/accessories
  acquisitionCost: number;       // ₱ value
  acquisitionDate: Date;
  accountableOfficer: string;    // Name of accountable officer
  division: string;
  officeOrSection: string;
  officeLocation: string;
  condition: AssetCondition;     // 'serviceable' | 'unserviceable' | 'for_repair' | 'for_disposal'
  supplier: string;
  dateOfDelivery: Date;
  assetClass: 'PPE' | 'SEP' | 'IES';
  assetType: AssetType;          // ICT | Fixed | Supplies
  qrCode: string;                // System-generated QR identifier
  barcodeValue: string;          // System-generated barcode
  status: AssetStatus;           // 'available' | 'issued' | 'transferred' | 'under_repair' | 'flagged_for_disposal' | 'disposed'
  custodianId: string;           // Current assigned user
  locationHistory: AssetTransaction[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.4 Asset Lifecycle States

```
[Registered] → [Available] → [Issued] → [Returned] → [Available]
                    │              │
                    │              └──[Under Repair] → [Available]
                    │
                    └──[Transferred] → [Available (new location)]
                    │
                    └──[Flagged for Disposal] → [Disposed]
```

Every state transition must:
1. Be authorized by the appropriate role
2. Update the asset record in real time
3. Generate an audit log entry with: user ID, action, timestamp, IP address, affected record ID
4. Trigger generation of the corresponding official COA/CICC form where applicable

---

## 6. Core Modules

### Module 1: Asset Registry & Lifecycle

**Primary user:** IT Personnel

Key screens (matching Figma mockup):
- Asset Inventory Dashboard (overview cards + table)
- Asset Details Page (full asset record + lifecycle history)
- Add New Asset Page (form with all required fields)
- Update Asset Lifecycle Page (status transitions: issue / return / transfer / repair / dispose)
- Generate QR Code Page (generate + print/download QR label)
- Scan QR Code Page (camera-based scan → auto-navigate to asset record)

**Business logic rules:**
- An asset cannot be issued if its status is not `available`
- An asset cannot be requisitioned as a replacement unless the existing asset has met useful-life threshold, condition criteria, or loss/damage criteria (replacement validation)
- A disposal flag requires documented justification, condition assessment, and recommended action — actual disposal execution is out of scope; only documentation is managed

### Module 2: Requisition & Approval Workflow

**Primary users:** Employee (requester), Supervisor (approver), IT Personnel (fulfiller)

Key screens (matching Figma mockup):
- Employee Dashboard (pending requests, quick submit button)
- Submit Requisition Page (asset type selector, quantity, justification, required date)
- Status Tracking Page (timeline view of request journey)
- Supervisor Dashboard (pending approvals queue, metrics)
- Review Requisition Page (approve / reject with comments)
- Approval History Page (chronological log of all decisions)

**Approval routing logic:**
- Employee submits → routes to immediate Supervisor
- Supervisor approves → routes to IT Personnel for fulfillment check and issuance
- If asset unavailable → system flags and notifies IT Personnel to log
- Escalation: if approval exceeds 24-hour SLA → alert triggered
- IT Personnel confirms issuance → PAR or ICS generated; status updated to `issued`

**SLA Target:** 24-hour requisition approval turnaround

### Module 3: Dashboard & Reporting

**Primary users:** IT Personnel, System Admin, Management

Key screens:
- IT Personnel Dashboard (inventory status, pending requisitions, low-stock alerts)
- System Administrator Dashboard (system health, user activity, audit overview)
- Management Dashboard (executive metrics: asset utilization, requisition rates, SLA compliance)
- Report Generation Page (select report type → export PDF/Excel)

### Module 4: User & Account Management

**Primary user:** System Administrator

Key screens:
- User Management Page (list, search, create, deactivate users)
- Role Assignment Page (assign/change user roles)
- Audit Trail Page (full immutable log of all system actions with filters)

**Additional admin API endpoints (implemented):**
- `PATCH /api/v1/users/:id/reset-password` — force-reset a user's password (requires `newPassword` matching full complexity rules); increments `tokenVersion` to invalidate all existing sessions. The IT-Personnel-facing UI is an in-app dialog (`PasswordResetDialog`) with a live complexity checklist — not a `window.prompt`.
- `PATCH /api/v1/users/:id/unlock` — clear `failedLoginAttempts` and `lockedUntil` on a locked account; use when a user is locked out due to repeated failed login attempts
- `PATCH /api/v1/users/:id/activate` — reactivate a deactivated account (`isActive = true`, also clears the lockout), audited. The counterpart to `deactivate` — before this there was no way back from `isActive = false` except a direct DB write. The admin UI shows **"Reactivate account"** for inactive accounts.

**Health endpoint (no auth):** `GET /api/health` — runs `SELECT 1`, returns `{ status, db, uptime }`, `503` when the DB is unreachable. Consumed by the `docker-compose*.yml` healthchecks and CICC IT's reverse proxy.

### Module 5: Notifications & Alerts

Auto-triggered alerts (in-system + email optional):

| Alert | Trigger | Recipients |
|---|---|---|
| Low stock | Asset quantity drops below configured threshold | IT Personnel, System Admin |
| Overdue return | Asset not returned past agreed date | IT Personnel, Supervisor, requestor |
| Pending approval | Requisition awaiting action > 12 hours | Supervisor |
| SLA breach | Approval not completed within 24 hours | System Admin, Management |
| Alternate approver | Primary supervisor unavailable | System-designated backup approver |

---

## 7. System-Generated Reports

All reports are generated from live database records at time of export. Access governed by RBAC.

### 7.1 Management Reports

| Report | Format | Audience |
|---|---|---|
| Asset Master List | PDF / Excel | IT Personnel, Management, Admin |
| Requisition History Log | PDF / Excel | Supervisors, IT Personnel, Management |
| Asset Issuance Record | PDF | IT Personnel, Management |
| Asset Return Record | PDF | IT Personnel, Management |
| Physical Count Summary | PDF / Excel | Management, Admin |
| Asset Utilization Summary | PDF / Excel | Management |
| Audit Trail Report | PDF / Excel | System Admin, Management |
| Disposal Documentation Report | PDF | IT Personnel, Management |

### 7.2 Official COA/CICC Transaction Forms (Auto-generated)

| File Reference | Official Form Name | Trigger Event |
|---|---|---|
| RIS | Requisition and Issue Slip | Employee submits supply/material requisition |
| RSMI | Report of Supplies and Materials Issued | IT Personnel completes supply issuance for a period |
| RSPI | Report of Supplies and Properties Issued | IT Personnel completes SEP/property issuance for a period |
| RECEIPT OF RETURNED PROPERTY-EQUI | Receipt of Returned Property/Equipment | Employee returns property item or equipment |
| RECEIPT OF RETURNED SEMI-EXPENDAB | Receipt of Returned Semi-Expendable Property | Employee returns SEP item |
| Property-Form-Annex-A.4 | Registry of Supplies/Property (Annex A.4) | IT Personnel registers/updates supply or property record |
| Move-In Form 2026 | Move-In / Asset Transfer Receiving Form | Receiving unit accepts transferred assets |
| MOVE OUT FORM 2026 | Move-Out / Asset Transfer Releasing Form | Originating unit releases assets to another unit |
| Appendix 58 - SC | Sticker Card | IT Personnel tags registered asset |
| Appendix 59 - ICS | Inventory Custodian Slip | IT Personnel issues SEP item to employee |
| Appendix 62 - IAR | Inspection and Acceptance Report | Inspection committee accepts newly procured assets |
| Appendix 65 - WMR | Waste Materials Report | IT Personnel documents waste/unusable materials |
| Appendix 66 - RPCI | Report on Physical Count of Inventories | Periodic physical count reconciliation |
| Appendix 71 - PAR | Property Acknowledgment Receipt | IT Personnel issues property item to employee |
| Appendix 73 - RPCPPE | Report on Physical Count of PPE | Periodic physical count of PPE items |
| Appendix 74 - IIRUP | Inventory and Inspection Report of Unserviceable Property | IT Personnel flags unserviceable assets |
| Appendix 75 - RLSDDP | Report of Lost, Stolen, Damaged, or Destroyed Property | IT Personnel/officer reports property loss/damage |
| Appendix 76 - PTR | Property Transfer Report | Inter-office/inter-unit property transfer |

> All forms follow official Commission on Audit (COA) format. Forms requiring physical signatures are printed and signed manually; digital copies are retained in AIMRS for audit reference.

---

## 8. Security Requirements (Security by Design)

Security controls are NOT add-ons — they are embedded from the first line of code.

### 8.1 Authentication
- Secure login with email/employee ID + password
- Password hashing: bcrypt (minimum 12 rounds)
- JWT-based sessions with expiry and refresh token rotation
- Account lockout after repeated failed attempts
- No default/shared credentials

### 8.2 Authorization
- RBAC enforced at NestJS `@Guard` level on every route — not just the frontend
- Principle of least privilege: no role has access beyond what is functionally required
- Role assignments managed only by System Administrator
- Frontend conditionally renders components based on active role (no hidden elements that remain accessible via URL)

### 8.3 Audit Trail
- Every system transaction logged: user ID, action type, affected record ID, timestamp (UTC), IP address, user role at time of action
- Audit logs are **append-only** — no update or delete operations on the audit table
- Full audit log list (`GET /api/v1/audit`) is restricted to System Administrator and Management
- IT Personnel can view transaction history for individual assets they manage via `GET /api/v1/audit/record/:recordId`
- Logs exportable as PDF/Excel for COA audit purposes

### 8.4 Data Minimization
- Collect only the personal data necessary for asset assignment and user account administration
- No HR data, no payroll, no leave records
- User profile: employee ID, name, email, division, office/section, role — nothing beyond this

### 8.5 Data Protection
- All data in transit: HTTPS/TLS (SSL certificates managed by CICC IT)
- Database credentials: environment variables only, never hardcoded
- Sensitive fields encrypted at rest where applicable
- No hardcoded secrets anywhere in the codebase (enforce via `.env` + secret scanning in CI)

### 8.6 Compliance References
- **Data Privacy Act of 2012 (RA 10173)** — Philippine data protection law
- **NPC Circular No. 2023-06** — Privacy by Design mandate for Philippine government systems
- **OWASP Application Security Verification Standard (ASVS)** — Applied during security testing phase
- **Commission on Audit (COA) documentation requirements** — Audit trail and form standards

---

## 9. ITIL 4 SVC Alignment

Each system module maps to a specific SVC activity. This is the academic framework — reference it in code comments, PR descriptions, and documentation where relevant.

| SVC Activity | System Realization |
|---|---|
| **Plan** | System configuration tables: asset categories, thresholds, role rules, SLA targets (24hr approval, 98% accuracy) |
| **Engage** | Employee requisition submission interface, request status tracking, issue reporting, multi-level notifications |
| **Design & Transition** | Multi-level approval hierarchy, alternate approver designation, RBAC structure, replacement validation rules, controlled asset movement authorization |
| **Obtain/Build** | Asset registration module, QR/barcode generation, official form suite, system development effort itself |
| **Deliver & Support** | Day-to-day issuance, return, transfer, repair, disposal documentation, event alerts, issue resolution |
| **Improve** | KPI dashboards, audit trails, lead time reports, inventory accuracy indicators, audit readiness tracking, stakeholder feedback |

---

## 10. Pages & UI Structure

### All Roles — Shared
- `/login` — Landing/login page (single unified login, role determines redirect)

### Employee (`/employee/`)
- `/employee/dashboard` — Overview: pending requests, recent activity
- `/employee/requisitions/new` — Submit requisition form
- `/employee/requisitions` — My requisitions list
- `/employee/requisitions/[id]` — Request status tracking (timeline view)
- `/employee/catalogue` — Browse available assets
- `/employee/notifications` — Notifications inbox

### Supervisor (`/supervisor/`)
- `/supervisor/dashboard` — Pending approvals queue, metrics
- `/supervisor/approvals` — All requisitions pending approval
- `/supervisor/approvals/[id]` — Review and approve/reject requisition
- `/supervisor/history` — Approval history log
- `/supervisor/notifications` — Notifications inbox

### IT Personnel (`/it-personnel/`)
- `/it-personnel/dashboard` — Inventory overview, alerts, pending fulfillments
- `/it-personnel/assets` — Full asset inventory table
- `/it-personnel/assets/new` — Add new asset form
- `/it-personnel/assets/[id]` — Asset details: full record + inline edit mode + context-aware lifecycle modal + transaction history panel + form suggestion banner (no sub-routes — lifecycle and QR are actions on this page)
- `/it-personnel/qr-scan` — QR/barcode scanner
- `/it-personnel/requisitions` — Fulfillment queue (approved requisitions)
- `/it-personnel/forms` — Generate official forms (RIS, PAR, ICS, etc.)
- `/it-personnel/reports` — Generate reports (Asset Master List, Issuance Records, etc.)
- `/it-personnel/notifications` — Notifications inbox

### System Administrator (`/admin/`)
- `/admin/dashboard` — System health, user activity, audit summary
- `/admin/users` — User management (CRUD)
- `/admin/users/[id]/role` — Role assignment
- `/admin/audit-trail` — Full audit log viewer (filterable, exportable)
- `/admin/config` — System configuration (thresholds, SLA targets, approval routes)
- `/admin/notifications` — Notifications inbox

### Management (`/management/`)
- `/management/dashboard` — Executive dashboard (KPIs, charts, utilization)
- `/management/reports` — Report generation and download
- `/management/audit-trail` — Read-only audit trail access

---

## 11. Key Technical Decisions & Constraints

### Do Not Deviate From These Without Team Consensus

1. **TypeScript only** — No plain JavaScript files in the project. Strict mode enabled.
2. **NestJS enforces all RBAC** — Frontend role-checks are UX only. Every protected action must be re-validated by the API.
3. **Audit logs are append-only** — Never add UPDATE or DELETE endpoints for the `audit_logs` table. This is non-negotiable for COA compliance.
4. **Supabase is development only** — All production code must work against raw PostgreSQL. Do not use Supabase-specific client features that would not work in production.
5. **No mobile app** — The system is web-based and responsive. A native iOS/Android app is explicitly out of scope.
6. **No external integrations** — No PhilGEPS, no COA eNGAS, no HR systems. AIMRS is a standalone internal platform.
7. **No procurement/financials** — The system begins at asset receipt. No purchase orders, no supplier bidding, no depreciation calculations, no budget management.
8. **No financial accounting** — Acquisition cost is recorded for identification purposes only, not for financial reporting.
9. **pdfkit must be webpack-externalized** — `pdfkit` reads font `.afm` files from `__dirname` at runtime. If bundled by webpack, `__dirname` resolves to `dist/` and pdfkit cannot find its font data (ENOENT). The fix is in `Backend/webpack.config.js`: `externals: { bcrypt: 'commonjs bcrypt', pdfkit: 'commonjs pdfkit' }`. Never remove this entry or pdfkit will silently break on the next build.
10. **COA form PDFs stored as `bytea` in DB** — `GeneratedFormEntity.pdfContent` column uses `{ type: 'bytea', select: false }`. The `select: false` excludes the blob from list queries for performance. To load it, you must use QueryBuilder with an explicit `.select(['f.pdfContent', ...])` — a plain `findOne()` will return `null` for `pdfContent`. The re-download endpoint is `GET /api/v1/reports/forms/:id/download`.
11. **`synchronize: false` in TypeORM** — Auto-sync is disabled. Any change to an entity that adds, removes, or alters a column requires a manual SQL migration run in Supabase SQL Editor (dev) or as a migration file (prod). Never re-enable `synchronize: true` — it can destructively drop columns on a schema mismatch.
12. **SnakeNamingStrategy** — TypeORM is configured with `SnakeNamingStrategy`. Entity property names in camelCase are automatically mapped to snake_case column names in PostgreSQL (e.g., `pdfContent` → `pdf_content`, `createdAt` → `created_at`). Do not specify `@Column({ name: 'snake_case' })` unless overriding the default — it is handled automatically.
13. **`@IsEnum` required on form DTOs** — The `GenerateFormDto.formType` field must have `@IsEnum(OfficialFormType)` applied. Without it, NestJS `ValidationPipe` passes any string through and the service throws an unhandled runtime error (500). All enum-typed DTO fields must use `@IsEnum()`.
14. **`tokenVersion` invalidation** — Making two login calls for the same user in the same session increments `tokenVersion` twice, invalidating all previous tokens for that user. Only make one login call per test/simulation per user. The `reset-password` endpoint also increments `tokenVersion` by +1 to force re-authentication.
15. **`ISSUED` lifecycle uses `employeeId`, not `custodianId`** — The `UpdateLifecycleDto` accepts `employeeId` (string, e.g. `CICC-0042`) for the `ISSUED` transition. The backend resolves it to a UUID via `UsersService.findByEmployeeId()` and sets `custodianId`. Never send a raw UUID to the `employeeId` field — it is a CICC employee ID string, not a UUID. The `custodianId` field on the DTO still exists as a fallback but the IT Personnel UI uses `employeeId`.
16. **`TRANSFERRED` lifecycle uses `toLocation`** — The `UpdateLifecycleDto` accepts `toLocation` (string) for the `TRANSFERRED` transition — this is the receiving office/section name. It is stored in the audit log metadata; the asset's `officeOrSection` is not automatically updated.
17. **`PATCH /api/v1/assets/:id` is for metadata edits only** — This endpoint accepts `UpdateAssetDto` (all 16 non-status fields optional). It does NOT accept `status`, `assetClass`, `assetType`, `qrCode`, `barcodeValue`, `id`, `custodianId`. Status transitions must go through `PATCH /api/v1/assets/:id/lifecycle`. Do not confuse the two endpoints.

18. **Docker build context is the repo root, not `Backend/` or `Frontend/`** — this is an npm-workspaces monorepo and both apps import `packages/shared`. `docker build -f Backend/Dockerfile .` (context `.`) with the Dockerfiles copying `packages/shared` beside the app. Reverting to `context: ./Backend` re-breaks the build (the `../../../packages/shared` import escapes the context). There is one root `package-lock.json` — no per-workspace lockfiles.

19. **DB TLS is `DATABASE_SSL`-driven** — default (unset) is verified SSL. `disable` for a local/CI Postgres that speaks no TLS; `no-verify` for a dev machine behind a TLS-intercepting proxy (set it in `Backend/.env`, never in code). This replaced the uncommitted `rejectUnauthorized: false` hack that used to live in `app.module.ts`.

### Out of Scope (Never Build These)
- Procurement and supplier management
- Financial accounting / payroll / depreciation for financial reporting
- Integration with external government systems (PhilGEPS, COA eNGAS)
- HR management (leave, performance evaluations, full personnel records)
- Native mobile application (iOS/Android)
- Asset disposal execution (only documentation and flagging — actual disposal is a manual COA process)

---

## 12. Testing Standards

### Unit Testing (Jest)
- **Coverage minimum:** 70% on all new backend service code before a story is marked done
- **Critical-path pass rate:** 100% — no exceptions
- Tests run automatically in CI on every push; failing tests block merges to `main`
- Key test areas: asset status transitions, requisition approval routing, RBAC enforcement, audit log generation, QR code utility functions, database interaction layers

### Integration Testing (Jest)
- API endpoint behavior across service boundaries
- Role-based access control across all protected routes
- Requisition workflow end-to-end (submit → approve → fulfill → update asset)

### Stress/Performance Testing (Apache JMeter)
- Simulates 362 concurrent users performing: login, requisition submission, dashboard view, QR scan, approval, report access
- Identifies performance bottlenecks before deployment
- Run during the Testing & Evaluation phase — needs a prod-like environment, a dedicated Postgres, and realistic data volume. The `.jmx` plan can be authored earlier.

### Load-test baseline (k6) — `perf/`
- An early first-pass check that de-risks the formal JMeter run — **not** a replacement for it, and deliberately **not** a CI gate.
- `perf/load-assets.js` ramps to 362 VUs on `GET /api/v1/assets`; `perf/seed-volume.sql` brings a throwaway docker Postgres to ~CICC scale (362 users / 2,000 assets / 8,000 audit rows). `perf/README.md` has the procedure.
- Baseline (2026-09-06, single contended machine): 362 VUs, 0 errors, p95 758 ms. The DB query is ~1 ms; latency under load is the single Node event loop serialising work — if the formal test confirms it at scale, the answer is 2–4 backend replicas behind a load balancer (a small compose change), not a code rewrite.
- Pool + rate-limit are now env-tunable — `DB_POOL_MAX` (default 20, was pg's 10), `THROTTLE_LIMIT` / `THROTTLE_TTL` (defaults 60 / 60 s per IP, unchanged).

### User Acceptance Testing (UAT)
- Structured evaluation instrument for Employees, Supervisors, IT Personnel
- Measures: system functionality, usability, SVC alignment, Security by Design compliance
- KPIs: requisition processing time, inventory accuracy, request status visibility, approval traceability, access control enforcement, audit trail completeness, report generation reliability, user satisfaction vs. manual process

### Security Testing
- OWASP ASVS checklist applied
- Test: privilege escalation (Employee attempting disposal flag → must be denied with `403`)
- Test: unauthorized API access without valid JWT token → must be denied
- Test: audit log immutability (no PUT/DELETE on audit_logs) → must be enforced

---

## 13. Development Workflow

### Git Strategy

#### Branch Model (3 branches)

> **2026-08-15:** Simplified from the original 5-branch GitFlow (`develop → test → uat → main`).
> The `test` and `uat` branches were never actually used — both sat at the same commit as
> `main` with zero unique history — so they were dropped rather than carried forward as
> unused ceremony. UAT-with-CICC and internal testing are still full activities (CLAUDE.md
> §12); they just run against `develop`/CI rather than a dedicated long-lived branch each.

All promotions between long-lived branches require a PR. No direct pushes to `develop` or `main`.

Promotion flow: `feature/<ticket-id>-<desc>` → `develop` → `main`

| Branch | Purpose | CI gates | Reviews required |
|---|---|---|---|
| `main` | Production — CICC handover build | All CI + all security checks | 2 |
| `develop` | Integration — all feature work lands here first | `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e` | 1 |
| `feature/<ticket-id>-<desc>` | Individual feature work | CI runs on push, no gate | 0 |

> CI also runs a **`docker-build`** job on every push — validates both compose
> files and builds both Dockerfiles' `production` target (the app images were
> never built in CI before, only the e2e Postgres container). Currently
> non-gating; promote it to a required check on `main` once it has run green
> for a while.

#### Branch Protection Summary
- `feature/*` — no protection (developer pushes freely)
- `develop` — requires PR + 1 review + `backend-ci`, `frontend-ci`, `backend-e2e`, `shared-pkg` green
- `main` — requires PR + 2 reviews + **all** checks green (adds `secret-scan`, `codeql`, `dependency-audit`, `owasp-dc` on top of `develop`'s checks — these used to be split across `test`/`uat`, now they all gate the final promotion to production) + force pushes blocked

#### Deploy Environments (activated when CICC provides server access)
- `main` branch → `prod-server` GitHub Environment (manual approval gate required)
- No dedicated deploy environment for `develop` — internal/JMeter/security testing runs against CI and local/Docker environments rather than a persistently deployed staging server (see CLAUDE.md §12)

### Sprint Structure (Agile Scrum)
- **Sprint length:** 2 weeks
- **Sprint events:** Sprint Planning, Daily Standup, Sprint Review, Sprint Retrospective
- **Roles:** Product Owner (CICC liaison + backlog), Scrum Master (facilitator), Development Team (all devs)
- Requirement changes identified during Sprint Review → logged and assessed → included in backlog for future sprints, never mid-sprint

### Scrum Acceptance Criteria Template
Every user story must include security acceptance criteria:
- [ ] Role-based access control enforced (only correct role can perform action)
- [ ] Audit trail entry generated for the action
- [ ] Data minimization verified (no unnecessary personal data collected)
- [ ] Input validation applied (no raw user input reaches database)
- [ ] Error responses do not expose internal system details

---

## 14. Project Timeline

| Phase | Duration | Deliverable |
|---|---|---|
| Planning & Requirements Analysis | Feb 25 – Mar 31, 2026 | Requirements documentation, stakeholder interviews |
| System Design | Apr 1 – May 15, 2026 | Architecture, DB schema, UI mockups, SVC mapping |
| **System Development** | **Jun 1 – Aug 15, 2026** | **← WE ARE HERE** All core modules implemented |
| Testing & Evaluation | Aug 16 – Sep 15, 2026 | Unit, stress, UAT, security testing |
| Deployment & Acceptance | Sep 16 – Oct 5, 2026 | Final system, documentation, CICC handover |

---

## 15. Environment Setup Notes

```bash
# Clone and install
git clone <repo-url>
cd cicc
npm install  # root workspaces install (installs Frontend + Backend + packages/shared)
# Or install individually:
cd Frontend && npm install
cd ../Backend && npm install

# Environment variables (never commit .env files)
# Backend/.env — copy Backend/.env.example, which documents every var:
#   DATABASE_URL      Supabase (dev) / raw PG (prod)
#   DATABASE_SSL      unset = verified TLS · 'disable' (local docker/CI) ·
#                     'no-verify' (dev box behind a TLS-intercepting proxy —
#                     set here, never in code; replaces the old app.module.ts hack)
#   DB_POOL_MAX       pg pool ceiling (default 20)
#   JWT_SECRET / JWT_REFRESH_SECRET   >= 32 random chars (Joi-enforced at startup)
#   ALLOWED_ORIGIN    CORS origin
#   TRUST_PROXY       proxy hops to trust so audit-log IPs are the real client
#                     (set 1 in prod behind CICC IT's proxy; unset when direct)
#   THROTTLE_LIMIT / THROTTLE_TTL     per-IP rate limit (default 60 / 60000ms)
#   SUPABASE_URL / SUPABASE_ANON_KEY  dev/test only

# Frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Docker (recommended for consistent dev environment). Build context is the
# repo root (npm workspaces); the dev compose runs postgres:16 and applies all
# Database/schemas/*.sql + the dev seed on first boot.
docker compose up --build

# Run tests
cd Backend && npm run test           # Unit tests
cd Backend && npm run test:cov       # Coverage report (thresholds enforced)
cd Backend && npm run test:e2e:local # E2E suite — spins a throwaway postgres:16
                                     # (docker-compose.e2e.yml, NODE_ENV=test),
                                     # exactly like CI's backend-e2e job. Needs
                                     # Docker running. Plain `npm run test:e2e`
                                     # targets Supabase and will not connect
                                     # from jest — use the :local variant.
```

---

## 16. Code Standards

- **Language:** TypeScript strict mode throughout
- **API style:** RESTful, with consistent response envelopes: `{ data, message, statusCode }`
- **Error handling:** All errors return structured JSON; never expose stack traces or DB internals in production responses
- **Validation:** Use `class-validator` + `class-transformer` DTOs in NestJS for all incoming request bodies
- **Database:** Use TypeORM (or Prisma) — no raw SQL strings with user-supplied data (SQL injection prevention)
- **Logging:** Use NestJS Logger; sensitive fields (passwords, tokens) must never appear in logs
- **Comments:** Code comments should explain *why*, not *what*. Add ITIL SVC activity references in service-layer methods where relevant (e.g., `// SVC: Deliver and Support — asset issuance`)
- **No hardcoded values:** No credentials, no environment-specific URLs, no magic numbers without named constants
- **Security linting:** `npm run lint` (ESLint security plugin), `npm run secretlint`, and `npm run audit:check` (dependency CVEs) must all pass with zero errors before any story is marked done. See `CHECKS.md` for the full ordered checklist.
- **Imports:** Use default imports for `helmet` and `cookie-parser` — `import helmet from 'helmet'` (NOT `import * as helmet`). Use `import { randomUUID } from 'crypto'` instead of the `uuid` npm package (ESM incompatibility with Jest).
- **TypeORM entity naming:** `SnakeNamingStrategy` is active — camelCase properties map automatically to snake_case columns. Do not add redundant `@Column({ name: '...' })` overrides unless deliberately changing the column name.
- **TypeORM migrations:** `synchronize: false` — every entity change that affects the schema must be accompanied by a SQL migration file in `Database/migrations/` and executed manually. Never use `synchronize: true` outside of a throw-away local environment.
- **webpack externals:** If a backend package reads files from `__dirname` at runtime (like `pdfkit`), it must be added to `Backend/webpack.config.js` externals so webpack doesn't bundle it. Check this before installing any new native or file-system-dependent library.
- **Quality checklist:** Before marking any task done, run every check in `CHECKS.md` in order. All must pass with zero errors.

---

## 17. Quick Reference — Key Business Rules

| Rule | Detail |
|---|---|
| SLA target | 24-hour requisition approval turnaround |
| Inventory accuracy target | 98% |
| Replacement validation | Must confirm useful-life threshold, condition, or loss/damage criteria before processing replacement requisition |
| Disposal | System documents and flags only; CICC executes actual disposal through COA procedure manually |
| Alternate approver | System must support designation of backup approvers when primary supervisor is unavailable |
| PPE threshold | ₱50,000 and above per item → PPE classification |
| SEP threshold | Below ₱50,000, useful life > 1 year → SEP classification |
| IES | Consumables, < 1 year useful life → IES classification |
| Audit log retention | All system transactions; immutable; accessible by Admin and Management |
| Physical signatures | COA forms requiring physical signatures are printed and manually signed; digital copies retained in AIMRS |

---

*This file is the single source of truth for AI-assisted development. Always refer to it before implementing a feature. If something contradicts the capstone paper or the Figma mockup, the paper and mockup take precedence — update this file accordingly and inform the team.*
