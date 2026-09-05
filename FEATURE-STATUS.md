# AIMRS — Feature Status (quick read)

One-screen map of what the system actually does today. For the detailed
version see `SYSTEM-STATUS.md` (narrative) and `MOCK-DATA-WIRING.md` (per-screen).

Legend: ✅ real backend + real UI, verified · 🟡 works but has a caveat ·
🔴 UI renders but the data is fake / nothing persists · ⬜ planned, no backend
yet · 🚫 out of scope.

---

## ✅ Working

**Auth & access**
- Login for all 7 roles, JWT + refresh-token rotation, per-route RBAC guards.
- Account lockout after N failed logins (N is runtime-configurable); admin
  force-reset-password and unlock.

**Requisitions**
- Full workflow end to end: employee submits → supervisor approves/rejects →
  IT/Property fulfils → asset issued. PAR/ICS generated on issuance.
- **Replacement validation** — a replacement requisition is only accepted if the
  requester holds the asset *and* it is unserviceable or past its useful life.
- **Alternate approver** — when a supervisor is marked unavailable, new
  requisitions route to a designated backup at submit time; a requisition that
  blows its 24h SLA with no decision is reassigned to the backup by the watcher.
  Self-service "I'm away" toggle + admin designation. *(built, PR pending)*

**Assets**
- Register / edit / lifecycle transitions (issue, return, transfer, repair,
  dispose-flag), QR + barcode generate and scan, per-asset transaction history.
- Supply stock: quantity + reorder level, stock drawn down transactionally on
  fulfilment.

**Notifications & SLA** *(automated)*
- Cron watchers: SLA breach, 12h pending-approval nudge, overdue return, low
  stock — each fires once (dedup), in-system delivery to every relevant role,
  live TopBar bell. Manual `POST /notifications/run-checks` trigger for testing.

**System configuration** — SLA hours, default reorder level, useful-life years,
max login attempts are editable at runtime (System Admin only, audited) and read
live by the workflow / watchers / auth. *(built, PR pending)*

**Admin & audit**
- User CRUD, role assignment, unlock, **reactivate** (`PATCH /users/:id/activate` —
  the counterpart to deactivate), reset-password (in-app dialog, not `window.prompt`).
- Audit trail: every mutation logged append-only (user, action, record, time, IP,
  role); filterable; full view for Admin + Management. Behind a proxy the client IP
  is real when `TRUST_PROXY` is set. *(activate + TRUST_PROXY: `fix/admin-shell-ui`, PR pending)*

**Infra**
- Docker: both images build (repo-root context), `docker compose up --build` brings up
  Postgres (all 7 schemas + seed) + backend + frontend with `/api/health` healthchecks.
  Prod compose fails fast on missing secrets. CI builds both images. *(`chore/docker-compose-fix`, PR pending)*
- k6 load baseline: 362 VUs, 0 errors, p95 758 ms (single contended box) — see `perf/`.

**Reports & forms**
- 18 COA form generators (PDF, stored, re-downloadable).
- Management reports (Asset Master List, Issuance/Return records, etc.) generated
  live from the database.

---

## 🟡 Works but has a caveat

- **Alternate approver** — after an SLA hand-off the backup inherits an
  already-blown deadline with no fresh clock or second escalation (deliberate:
  "one hop, no chain"); "unavailable until <date>" is date-granularity (expires
  ~08:00 that day).
- **COA form templates** — all 18 render, but fields/signatories need correcting
  against the real references (Move-In/Move-Out property-type bug, RSMI zeroed
  cost, WMR & IIRUP missing sections).

---

## 🔴 Still on mock data (UI renders, nothing real behind it)

- **Master Admin** — access reviews, org units, approval-route config, custodian
  coverage, master/reference data, system health & jobs, security policies. All
  `admin.mock.ts`; **no backend at all** (biggest remaining chunk). Dashboard: 2
  of 6 panels are real.
- **Management dashboards** — trend / utilisation / KPI chart panels show
  "Preview data" (no trends endpoint).
- **Employee** — "my assigned assets" panel (preview data); Returns & Incidents
  tab (in-memory only, nothing persists).
- **Approving Officer** — `approval-history` list (backend exists — needs wiring).
- **Property Officer** — `disposal`, `audit` (backend exists — needs wiring);
  `corrections`, `reconciliation`, `replacements` (no backend).
- **Generic fallthrough** — any role + screen not on the live-fetch allow-list
  renders `WorkflowPage.tsx` mock rows by default.
- **Dead mock code** — `lib/services/mock-*.service.ts` (×5), `laptops.mock.ts`
  + `LaptopAssetDetail/Form`, `AssetInventoryGallery.tsx`, `RoleDashboard.tsx`:
  unreferenced, safe to delete.

---

## ⬜ Not built yet (planned)

- **Disposal workflow** — turn the dispose-flag into a documented flow with the
  COA-required fields (justification, condition assessment, recommended action).
- **Returns / Incidents module** — employee return request, repair request,
  damage/loss/theft report + audit.
- **Physical count / reconciliation** — blocks the RPCI / RPCPPE / Physical Count
  Summary reports and the physical-inventory screens.
- **Master Admin governance backend** — the modules behind the 🔴 Master Admin
  screens above.
- **Trends / utilisation endpoint** — for the 🔴 Management chart panels.

---

## 🚫 Out of scope (never building)

Procurement / supplier management · financial accounting / payroll / depreciation ·
external gov integrations (PhilGEPS, COA eNGAS) · HR management · native mobile app ·
actual disposal execution (manual COA process) · alternate-of-the-alternate chains.
