# AIMRS — Feature Status (quick read)

One-screen map of what the system actually does today. For the narrative and
history see `SYSTEM-STATUS.md`; for what is left before handover see
`PATH-TO-DONE.md`; for which screens are live see `MOCK-DATA-WIRING.md`.

Legend: ✅ real backend + real UI, verified · 🟡 works but has a caveat ·
⬜ not built · 🚫 out of scope. (There is no 🔴 "mock" row any more: the
frontend contains no sample data, see below.)

> **As of 2026-10-16.** Everything below is in `develop` (PRs #102, #103, #105, #106,
> #107 and #109), plus the Property Officer → Property Custodian role merge on the
> `refactor/merge-property-officer-into-custodian` branch. `main` is still behind
> `develop`. Schemas 001–017 must be applied to any database that predates them
> (`Database/README.md`); the shared Supabase dev database is at 016, so 017 is pending.

---

## ✅ Working

**Auth & access**
- Login for all 6 roles, JWT + refresh-token rotation (one shared refresh, so
  parallel requests no longer log you out), per-route RBAC guards.
- Account lockout after N failed logins (N is runtime-configurable); admin
  force-reset-password, unlock, reactivate, force sign-out. Login is rate-limited
  (10/min per IP). The audit log records the real client IP (`req.ip` + `TRUST_PROXY`).

**Requisitions**
- Full workflow end to end: submit → supervisor approves/rejects → custodian
  fulfils → asset issued. PAR/ICS generated on issuance.
- **Four roles file requisitions** — Employee, Supervisor, IT Personnel, Property
  Custodian — routed to the Approving Officer of their section,
  else division. Management and the System Administrator do not file.
- **Segregation of duties** — a requisition is never routed to or decided by its
  own requester, and a custodian (IT or Property) **never fulfils or holds their
  own**: it is hidden from their queue and refused with a 403. Another custodian
  does, or, for exactly those, the System Administrator (Master Admin →
  Requisition Fulfilment).
- **Request type is derived, never picked** — `supply` for an IES item, `new`
  otherwise, `replacement` only from My Assigned Assets; a `repair` requisition is
  refused (repairs are Returns & Incidents). Items are picked from live
  inventory; "Not in inventory" lines are flagged.
- **Replacement validation** — accepted only if the requester holds the asset and
  it is unserviceable, repaired too often (default 3 in 12 months, configurable),
  past its useful life, or held while flagged for disposal. One open replacement
  per asset. Fulfilling it takes the old unit back and can issue the new unit in
  the same step; the requester can download the receipt.
- **Alternate approver** — a supervisor marked unavailable routes new requisitions
  to a designated backup; a requisition past its 24 h SLA is reassigned to the
  backup by the watcher. A supervisor's own requisition goes to their alternate.
- Supply requisitions draw stock down transactionally on fulfilment (stock
  record is chosen on the fulfil dialog).

**Assets**
- Register / edit / lifecycle (issue, return, transfer, repair, flag for disposal,
  restore a flagged asset with a written justification), QR + barcode generate and
  scan, per-asset transaction history.
- Supply stock: quantity + reorder level; supply lines are stock, not units (they
  cannot be issued or transferred as a unit).
- Custody & Issuance shows who holds each asset; the asset list says who holds it.
- **My Assigned Assets** for every role, with replacement eligibility per item.
- **Physical Inventory** count sheet (read-only against live assets) and
  **Disposal Recommendations** / **Disposal Review** (documented justification,
  condition and recommended action; the disposal itself stays a manual COA step).

**Returns & Incidents** (schemas 010–012)
- The holder files return / repair / damage / loss / theft with up to 3
  attachments; a custodian approves → marks received. A rejection needs a reason
  of 10+ characters and a confirmation. One open case per item (a loss/theft
  supersedes a pending hand-over). The server enforces the date rules (an incident
  cannot be dated in the future, a return cannot be in the past).
- System Admin decides a custodian's own request.
- Completion drives the lifecycle and auto-generates the COA documents
  (Receipt, RLSDDP, IIRUP), downloadable by the requester.

**Maintenance & Repair** (schemas 013–014)
- One repair record per stay `under_repair`, whichever screen sent it. Queue for
  IT Asset Custodian + Property Custodian (and Master Admin → Escalations →
  Repairs). Outcome repaired (back to holder or stock) / not repairable (flagged
  for disposal). A **loaner unit** can be lent while it is away. Condition follows
  the lifecycle. Repair History on the asset page and as a PDF/Excel report.

**Notifications & SLA** (automated)
- Cron watchers: SLA breach, 12 h pending-approval nudge, overdue return, low
  stock, overdue repair — each fires once (dedup), in-system, live TopBar bell.
  Clicking one deep-links to the record's drawer (`?open=<id>`).
- `GET /notifications/watcher-status` and the admin dashboard show each watcher's
  last run and count; `POST /notifications/run-checks` triggers a pass.
- The server runs on CICC time (Asia/Manila), so the daily jobs and day
  boundaries are right inside a UTC container.

**System configuration** — SLA hours, default reorder level, useful-life years,
max login attempts, repeat-repair limit, **entity name and Fund Cluster** are
editable at runtime (System Admin only, audited, with "last changed … by …").

**Admin & audit**
- User CRUD, role assignment, unlock, reactivate, reset-password (in-app dialog),
  force sign-out; directory has a role filter and a live **Locked** status.
- Append-only audit trail for every mutation, filterable by action and date range,
  per-account activity in the user drawer, per-asset history in scope. **Screens
  show names and numbers, not ids** (person, AR-/REQ- number, asset, form number).
- **Audit Trail Report** (PDF / Excel, up to 10,000 rows) for the System
  Administrator and Management.

**Reports & forms**
- 18 COA form generators (PDF, stored, re-downloadable). The seven
  per-transaction forms (PAR, ICS, PTR, IAR, the two receipts, RLSDDP, Move-Out)
  carry a **real running number** `<SERIES>-<YYYY>-<NNNN>` allocated atomically
  with the form; the entity name and Fund Cluster come from System Settings.
- Registers paginate; tables fit the page; the RSMI and RPCI no longer print
  guesses (RSMI prices supplies from the stock they came from; the RPCI leaves the
  physical count blank).
- **Reports & Forms** screen: a catalogue of the 18 forms with record pickers, and
  the archive (search by document number). Management reports (Asset Master List,
  Issuance / Return records, Requisition History, Disposal, Physical Count, Repair
  History, Audit Trail) are generated live; an unknown report type is a 400.

**UI**
- **No mock or sample data anywhere in the frontend.** Every reachable screen reads
  real records and every button saves through the API. An address with no real
  screen is a 404.

**Infra / quality**
- Docker: both images build (repo-root context); `docker compose up --build` brings
  up Postgres (all 17 schemas + seed) + backend + frontend with `/api/health`
  healthchecks; prod compose fails fast on missing secrets; CI builds both images.
- Formal security e2e suite (8 ASVS scenarios) gates CI. Backend 800 unit tests
  (96% statements), 94 e2e on a real Postgres, frontend 327 tests.
- k6 load baseline: 362 VUs, 0 errors, p95 758 ms (single contended box), `perf/`.

---

## 🟡 Works but has a caveat

- **COA form templates** — all 18 render with correct data and layout, but several
  still differ from CICC's official forms: an extra unofficial third signatory
  (PAR, ICS, IAR, the receipts, RLSDDP), WMR missing its Certificate of Inspection,
  IIRUP missing its accounting columns and Witness, Move-In/Move-Out print
  "Property Type: Office" always, and Sticker Card is an asset tag rather than
  Appendix 58's Stock Card. Item-by-item status: `docs/guides/COA-FORMS-AUDIT.md`.
- **Annex A.4** is titled "…Issued" but lists every SEP asset created in the period,
  including stock that was never issued.
- **Period reports** treat an end date as midnight, so items created later that
  same day fall outside a period ending today (RSMI, RSPI, Annex A.4, RPCI…).
- **Asset history** shows who did something by role ("IT Asset Custodian"), not by
  person; PAR / ICS / RLSDDP print the asset's registered section, not the end
  user's, as Office/Section.
- **Approver coverage** — each division that files needs an active Approving
  Officer. Property and Supply Management has one (`CICC-SUP-002`); if it is
  deactivated its two roles cannot submit ("No supervisor is configured").
- **Alternate approver** — after an SLA hand-off the backup inherits an
  already-blown deadline with no fresh clock ("one hop, no chain").
- **Physical count** is read-only: there is nowhere to record a count or reconcile.

---

## ⬜ Not built

- **Recording a physical count / reconciliation** (and inventory
  corrections). Blocks a real RPCI / RPCPPE reconciliation.
- **Trends / utilisation reporting** — the Management dashboard shows real status
  shares, not monthly trends; the Asset Utilization Summary report does not exist.
- **Stock Card** (Appendix 58) — the Sticker Card generator is a different document.

---

## 🚫 Out of scope (never building)

Procurement / supplier management · financial accounting / payroll / depreciation ·
external gov integrations (PhilGEPS, COA eNGAS) · HR management · native mobile app ·
actual disposal execution (manual COA process) · alternate-of-the-alternate chains ·
Master Admin governance tooling — access reviews, org-unit registry, approval-route
config UI, custodian-coverage report, reference/master-data CRUD, system health & jobs
console, security-policy toggles (cut 2026-09-09; roles are code-defined, config lives
in System Settings, audit lives in the Audit Log).
