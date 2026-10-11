# AIMRS — Feature Status (quick read)

One-screen map of what the system actually does today. For the detailed
version see `SYSTEM-STATUS.md` (narrative) and `MOCK-DATA-WIRING.md` (per-screen).

Legend: ✅ real backend + real UI, verified · 🟡 works but has a caveat ·
🔴 UI renders but the data is fake / nothing persists · ⬜ planned, no backend
yet · 🚫 out of scope.

> **2026-09-10:** every *(PR pending)* / *(built, PR pending)* tag below is now
> **merged to `origin/main`** — alternate approver (#89/#90), watcher-status +
> config `meta` + revoke-sessions + audit date range + directory role/lock filters
> (#98), system config (#87), `fix/admin-shell-ui` activate + TRUST_PROXY (#96),
> the Docker/deploy pass (#95), and the formal Jest security suite (#92).
> `origin/develop` and `origin/main` are byte-identical.
>
> **2026-10-11:** items tagged *(PR #102)* are on
> `feature/returns-incidents-and-workflow-fixes`, open against `develop` with
> every CI check green — Returns & Incidents, Maintenance & Repair (schema 013),
> derived request types + the replacement flow, self-approval routing fix,
> notification deep-links. Schemas 008–013 must be applied to any database that
> predates them (see `NEXT-TIME.md` §1).

---

## ✅ Working

**Auth & access**
- Login for all 7 roles, JWT + refresh-token rotation, per-route RBAC guards.
- Account lockout after N failed logins (N is runtime-configurable); admin
  force-reset-password and unlock.

**Requisitions**
- Full workflow end to end: employee submits → supervisor approves/rejects →
  IT/Property fulfils → asset issued. PAR/ICS generated on issuance.
- **Request type is derived, never picked** — `supply` for an IES item, `new`
  otherwise, `replacement` only when started from My Assigned Assets; a `repair`
  requisition is refused (repairs are Returns & Incidents). Items are picked from
  live inventory; "Not in inventory" lines are flagged. *(PR #102)*
- **Replacement validation** — a replacement requisition is only accepted if the
  requester holds the asset *and* it is unserviceable, past its useful life, or
  held while flagged for disposal; one open replacement per asset. Fulfilling it
  takes the old unit back (`returned`) and generates its Receipt. *(flow: PR #102)*
- **Segregation of duties** — a requisition is never routed to, or decided by,
  its own requester (a Supervisor's own request goes to their alternate or
  another Supervisor of the section/division). *(PR #102)*
- **Alternate approver** — when a supervisor is marked unavailable, new
  requisitions route to a designated backup at submit time; a requisition that
  blows its 24h SLA with no decision is reassigned to the backup by the watcher.
  Self-service "I'm away" toggle + admin designation. *(merged, PR #89/#90)*

**Assets**
- Register / edit / lifecycle transitions (issue, return, transfer, repair,
  dispose-flag), QR + barcode generate and scan, per-asset transaction history.
- Supply stock: quantity + reorder level, stock drawn down transactionally on
  fulfilment.
- **My Assigned Assets** for every role (`GET /assets/mine`), with replacement
  eligibility per item. *(PR #102)*

**Returns & Incidents** *(PR #102, schemas 010–012)*
- Holder files return / repair / damage / loss / theft with up to 3 attachments;
  custodian approves → marks received. One open case per item (a loss/theft
  supersedes a pending hand-over). System Admin decides a custodian's own request.
- Completion drives the lifecycle and auto-generates the COA documents (Receipt,
  RLSDDP, IIRUP), downloadable by the requester.

**Maintenance & Repair** *(PR #102, schema 013)*
- One `asset_repairs` record per stay `under_repair`, whichever screen sent it.
  Queue for IT Asset Custodian + Property Custodian (and Master Admin →
  Escalations); outcome repaired (back to holder or stock) / not repairable
  (flagged for disposal, holder becomes replacement-eligible). Condition follows
  the lifecycle. Repair History on the asset page + as a PDF/Excel report.

**Notifications & SLA** *(automated)*
- Cron watchers: SLA breach, 12h pending-approval nudge, overdue return, low
  stock, **overdue repair** *(PR #102)* — each fires once (dedup), in-system
  delivery to every relevant role, live TopBar bell. Manual
  `POST /notifications/run-checks` trigger for testing.
- Clicking a notification deep-links to the record's drawer (`?open=<id>`).
  *(PR #102)*
- `GET /notifications/watcher-status` reports the last completed sweep (time,
  trigger, per-watcher counts); shown on the admin dashboard's Platform-health
  panel. *(merged, PR #98)*

**System configuration** — SLA hours, default reorder level, useful-life years,
max login attempts are editable at runtime (System Admin only, audited) and read
live by the workflow / watchers / auth. `GET /system-config` also returns a
per-key `meta` (`updatedAt` / `updatedBy`), surfaced as "Last changed … by …"
on System Settings and the dashboard. *(merged, PR #87; `meta` via PR #98)*

**Admin & audit**
- User CRUD, role assignment, unlock, **reactivate** (`PATCH /users/:id/activate` —
  the counterpart to deactivate), reset-password (in-app dialog, not `window.prompt`),
  **force sign-out** (`PATCH /users/:id/revoke-sessions` — bumps `tokenVersion`
  only). Directory has a role filter and a live **Locked** status.
- Audit trail: every mutation logged append-only (user, action, record, time, IP,
  role); filterable by action **and date range**; per-account activity drill-down
  (`GET /audit/user/:id`) shown in the user drawer; full view for Admin + Management.
  Behind a proxy the client IP is real when `TRUST_PROXY` is set.
  *(activate + TRUST_PROXY: PR #96; revoke-sessions / role filter /
  date range / per-user drill-down: PR #98 — both merged)*

**Infra**
- Docker: both images build (repo-root context), `docker compose up --build` brings up
  Postgres (all 7 schemas + seed) + backend + frontend with `/api/health` healthchecks.
  Prod compose fails fast on missing secrets. CI builds both images. *(merged, PR #95)*
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

- **Management dashboards** — trend / utilisation / KPI chart panels show
  "Preview data" (no trends endpoint).
- **Employee** — dashboard tiles marked "PREVIEW DATA". (My Assigned Assets and
  Returns & Incidents are live since PR #102.)
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
- **Physical count / reconciliation** — blocks the RPCI / RPCPPE / Physical Count
  Summary reports and the physical-inventory screens.
- **Trends / utilisation endpoint** — for the 🔴 Management chart panels.

---

## 🚫 Out of scope (never building)

Procurement / supplier management · financial accounting / payroll / depreciation ·
external gov integrations (PhilGEPS, COA eNGAS) · HR management · native mobile app ·
actual disposal execution (manual COA process) · alternate-of-the-alternate chains ·
Master Admin governance tooling — access reviews, org-unit registry, approval-route
config UI, custodian-coverage report, reference/master-data CRUD, system health & jobs
console, security-policy toggles (cut 2026-09-09; roles are code-defined, config lives
in System Settings, audit lives in the Audit Log).
