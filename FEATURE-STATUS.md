# AIMRS — Feature Status (quick read)

One-screen map of what the system actually does today. For the detailed
version see `SYSTEM-STATUS.md` (narrative) and `MOCK-DATA-WIRING.md` (per-screen).

Legend: ✅ real backend + real UI, verified · 🟡 works with a gap / UI is still
mock / built-but-not-merged · ⬜ planned, no backend yet · 🚫 out of scope.

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
- User CRUD, role assignment, unlock, reset-password.
- Audit trail: every mutation logged append-only (user, action, record, time, IP,
  role); filterable; full view for Admin + Management.

**Reports & forms**
- 18 COA form generators (PDF, stored, re-downloadable).
- Management reports (Asset Master List, Issuance/Return records, etc.) generated
  live from the database.

---

## 🟡 Partial / has a known gap

- **Master Admin governance pages** — access reviews, org units, approval-route
  config, custodian coverage, system-events feed, scheduled-jobs status: UI
  exists but is mock (`admin.mock.ts`), no backend at all. *Biggest remaining chunk.*
- **Management dashboard charts** — trend / utilisation panels show "Preview
  data"; no trends endpoint yet.
- **Approving Officer `approval-history`, Property Officer `disposal` / `audit`** —
  still the generic mock list; the backend exists, just needs wiring (one-liners).
- **COA form templates** — all 18 render, but fields/signatories need correcting
  against the real references (Move-In/Move-Out property-type bug, RSMI zeroed
  cost, WMR & IIRUP missing sections).
- **Alternate approver** — after an SLA hand-off the backup inherits an
  already-blown deadline with no fresh clock or second escalation (deliberate:
  "one hop, no chain"); "unavailable until <date>" is date-granularity (expires
  ~08:00 that day).
- **Employee "my assigned assets"** slice — shows preview data (needs an
  assigned-to-me asset filter).

---

## ⬜ Not built yet (planned)

- **Disposal workflow** — turn the dispose-flag into a documented flow with the
  COA-required fields (justification, condition assessment, recommended action).
- **Returns / Incidents module** — employee return request, repair request,
  damage/loss/theft report + audit.
- **Physical count / reconciliation** — blocks the RPCI / RPCPPE / Physical Count
  Summary reports and the physical-inventory screens.
- **Alternate approver refinements** — alternate-of-the-alternate chains, fresh
  SLA clock on hand-off, notify the away primary. *(none planned; listed for clarity)*

---

## 🚫 Out of scope (never building)

Procurement / supplier management · financial accounting / payroll / depreciation ·
external gov integrations (PhilGEPS, COA eNGAS) · HR management · native mobile app ·
actual disposal execution (manual COA process).
