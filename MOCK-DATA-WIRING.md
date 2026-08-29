# Mock Data → Real Wiring — Handoff Index

**Purpose:** one-page map of every mock-data source in the frontend, what it must
connect to (frontend client → backend endpoint → DB), and what is just dead code to
delete. Hand a role section to a teammate; hand this whole file back to an LLM to
resume the migration.

**Snapshot:** 2026-08-29 · working tree of branch `feature/notifications-auto-fire-sla-cron`.
The porting work below is already on `origin/main` (see callout); this branch adds the
notifications/SLA commits on top and is not upstream yet.

> **2026-08-29:** notifications are now real for **every** role. The new-layout
> `[[...slug]]` routers for Approving Officer, Property Custodian, Property Officer,
> Management & Audit, and Master Admin now return `<NotificationsContent />` for the
> `notifications` segment (was `WorkflowPage` mock for all but IT Asset Custodian);
> a "Notifications" nav entry was added where missing. The **TopBar bell** now reads
> `notificationsApi.list()` (real unread count + newest 3). The dev-only "Preview role"
> switcher (`RoleSwitcher.tsx`) was deleted. `notificationMockRows` is now only
> referenced by `WorkflowPage.tsx` and no longer reachable for any `notifications` route.

> ### The redesigned-layout porting is DONE and on `main` — READ THIS
> The 5-phase port that wired the redesigned layout to the real backend
> (former plan `docs/superpowers/plans/2026-08-22-port-real-wiring-to-new-layout.md`,
> **deleted 2026-08-28** once merged) reached **`origin/develop` via PR #82 and
> `origin/main` via PR #83** (both 2026-08-27). The record is
> `git log --oneline origin/main` — NOT local `main`, which in this clone is ~150 commits
> stale; always compare against `origin/`. `SYSTEM-STATUS.md` was refreshed 2026-08-28 to
> match.
>
> So this is **not** "finish the porting plan." The redesigned-layout roles are wired
> wherever a backend exists. What is still mock (below) is almost all **greenfield
> backend work** — screens whose backend was never built — plus a handful of one-line
> "extend the live path to this role too" gaps.

---

## 0. How mock data is wired (orientation)

| Layer | Location | State |
|---|---|---|
| Toggle | `Frontend/lib/config.ts` → `appConfig.useMockData` (`NEXT_PUBLIC_USE_MOCK_DATA !== 'false'`) | mock ON by default |
| Mock data | `Frontend/lib/mock/*.mock.ts` (14 files) | some live-referenced, some dead |
| Mock service wrappers | `Frontend/lib/services/mock-*.service.ts` (5 files) | **all 5 have zero importers — dead** |
| Real API clients | `Frontend/lib/api/*.ts` (assets, audit, auth, notifications, reports, requisitions, users) | working; used by old layout + all ported new-layout screens |
| Generic mock page | `Frontend/components/prototype/WorkflowPage.tsx` | drives the new-layout list pages a role router does NOT special-case; an `isLiveFetchPage` allow-list decides mock vs real per role+slug |

**Backend modules that exist:** `assets`, `audit`, `auth`, `notifications`, `reports`,
`requisitions`, `scheduler`, `system-config` (new — `feature/system-config`, PR pending),
`users`.
**Do NOT exist yet:** returns/incidents, physical-count / reconciliation,
inventory-corrections, replacement-validation, and every Master-Admin governance domain
(access reviews, org units, approval-route config, custodian coverage, reference/master
data, system-events feed, scheduled-jobs status).

---

## Part A — Delete outright (no backend, no wiring)

Nothing routes to these. Deleting is safe once the one listed reference is cleared.

| Delete | Only referenced by | Note before deleting |
|---|---|---|
| `lib/services/mock-approvals.service.ts` · `mock-assets.service.ts` · `mock-notifications.service.ts` · `mock-reports.service.ts` · `mock-requisitions.service.ts` | nothing | pure dead code |
| `lib/mock/workflow.mock.ts` (`workflowCards`) | nothing | — |
| `lib/mock/approvals.mock.ts` | only the dead `mock-approvals.service.ts` | dies with it |
| `lib/mock/laptops.mock.ts` + `components/assets/LaptopAssetDetail.tsx` + `components/assets/LaptopAssetForm.tsx` + `lib/validation/laptop-asset.schema.ts` | each other + one test import of `LaptopAssetForm` | **no route mounts them.** Real asset UI is `RegisterAssetForm` / `AssetDetailManager`. Drop the test, keep `ictAssetSubtypes` (move to a plain constants file) if the real register form needs the subtype list |
| `components/inventory/AssetInventoryGallery.tsx` | nothing | old mock registration wizard, superseded by `RegisterAssetForm` |
| `components/prototype/RoleDashboard.tsx` + `lib/mock/dashboard.mock.ts` `getDashboardMockData()` | `RoleDashboard` has no importers | real dashboards are the `RoleDashboardShell`-based ones. **Before deleting `dashboard.mock.ts`:** its *type* exports (`KpiMetric`, `TrendPoint`, `ConditionSlice`, `CategoryValue`, `ActivityRow`) are still imported by `components/dashboard/{KpiCard,LineChart,DonutChart,BarChart,ActivityTable}.tsx` — move those types to a non-mock file first |

---

## Part B — Still mock, by role

Legend: **LIVE** already real · **MOCK** still mock · **PARTIAL** mixed
"WorkflowPage MOCK" = the slug is not special-cased in the role router and not in
`isLiveFetchPage`, so `WorkflowPage.tsx` renders it from `lib/mock/*`.

### Employee — `app/employee/*` → `components/employee/EmployeeWorkspace.tsx` — PARTIAL
| Screen | Mock source | Connect to | Backend / DB work |
|---|---|---|---|
| Catalogue · My Requisitions · New Requisition · Requisition detail · Notifications | — | `assetsApi.catalogue()`, `requisitionsApi.*`, `NotificationsContent` | none — LIVE |
| Dashboard (`EmployeeDashboard.tsx`) — "my assigned assets" slice only | `assetMockRows` (labeled "Preview data") | `assetsApi` filtered to current user as custodian | **add a `custodianId` / `assignedToMe` filter to `GET /v1/assets`** (see Part D #1) |
| Assigned Assets tab | `assetMockRows.filter(assignedEmployeeId)` | same | same filter |
| Returns & Incidents tab | `assetMockRows` (asset picker) + in-memory list, nothing persists | new `returnsApi` / `incidentsApi` | **new backend module** (Part D #3) — return request, repair request, damage/loss/theft report; entity + endpoints + audit log |

### Supervisor — `app/supervisor/*` — LIVE
Dashboard, approvals list/detail, history, notifications all real. Nothing.

### IT Personnel — `app/it-personnel/*` — LIVE
Assets (list/new/detail/lifecycle), QR scan, requisitions, forms (`FormsWorkspaceContent`),
reports (`ReportsContent`), audit, notifications all real. Nothing.

### System Administrator — `app/admin/*` — PARTIAL
| Screen | Mock source | Connect to | Backend / DB work |
|---|---|---|---|
| Dashboard · Users (CRUD) · Role assignment · Audit trail · Notifications | — | `usersApi`, `auditApi`, `NotificationsContent` | none — LIVE |
| **System Configuration** — Master Admin → System Settings (`AdminPlatformPages.tsx` → `SystemSettingsPage`, `/master-admin/configuration`) | **LIVE** (`feature/system-config`, PR pending) — `systemConfigApi` load/save, load-error retry. Old `/admin/config` page **deleted**. | `systemConfigApi` → `GET`/`PATCH /api/v1/system-config` | **core done** — `system-config` module: key-value `system_config` table, admin-only + audited, SLA hours / reorder level / useful-life years / max login attempts. Still pending in `SystemSettingsPage`: the numbering / notifications / forms & print / data retention / localization tabs (labelled "not yet configurable"), `reference-data`, + deferred settings (approval routes, session policy, PPE cost threshold) |

### Management — `app/management/*` — PARTIAL (near-LIVE)
Dashboard KPI cards + SLA panel real (`reportsApi.kpi()`); reports and audit trail real.
Two dashboard chart panels — "Monthly Requisition Trends", "Asset Utilization by
Category" — are hard-coded arrays, now labeled **"Preview data"**. Same gap as
Management&Audit's dashboard below; needs a trends/utilization reporting endpoint.

---

### Approving Officer — `app/approving-officer/[[...slug]]` — PARTIAL
| Slug | State | To finish |
|---|---|---|
| `dashboard`, `approvals`, `requisitions` | LIVE (`ApprovingOfficerDashboard`, `isLiveFetchPage`) | — |
| `approval-history` | WorkflowPage MOCK | add `role+slug` to `isLiveFetchPage` + a `fetchLiveRows()` branch on `requisitionsApi.list()` filtered to decided items |
| `notifications` | **LIVE** (2026-08-29) | router now returns `<NotificationsContent />` for this segment |

### IT Asset Custodian — `app/it-asset-custodian/[[...slug]]` — LIVE (one gap)
Dashboard, notifications, assets (list/new/detail), QR scanner, reports/forms, and
`WorkflowPage` slugs `fulfillment` / `custody` / `maintenance` / `disposal` all real.
- `physical-inventory` slug → WorkflowPage MOCK — no physical-count backend exists (Part D #4)

### Master Admin — `app/master-admin/[[...slug]]` → `components/admin/AdminWorkspace.tsx` — MOSTLY MOCK
| Slug(s) | Component | State | Backend / DB work |
|---|---|---|---|
| `users`, `roles`, `audit` | `AdminIdentityPages` / `AdminPlatformPages` | **LIVE** (`usersApi`, `auditApi`) | — |
| `dashboard` | `AdminDashboard` | PARTIAL — 2 of 6 panels real (`usersApi.list`, `auditApi.list`); other 4 use `admin.mock` (`adminActivityTrend`, `accessReviews`, `scheduledJobs`, `systemEvents`), labeled "Preview data" | wire the 4 panels once their sources exist |
| `access-reviews`, `organizational-units` | `AdminIdentityPages` | MOCK (`accessReviews`, `organizationUnits`) | **new** — access-review workflow; org-unit registry |
| `approval-configuration`, `custodian-assignments` | `AdminGovernancePages` | MOCK (`approvalWorkflows`, `custodianCoverage`) | **new** — approval-route config table; custodian-coverage report (derivable from `users` + `assets`) |
| `reference-data`, `configuration` | `AdminPlatformPages` | MOCK (`masterDataGroups`) | **new** — reference/master-data CRUD; shares the config module (Part D #2) |
| `technical-logs`, `security` | `AdminPlatformPages` | MOCK (`scheduledJobs`, `systemEvents`) | scheduled-jobs status can come from the `scheduler` module; system-events feed can reuse `auditApi` |

### Property Custodian — `app/property-custodian/[[...slug]]` — LIVE (one gap)
Dashboard, `fixed-assets` / `supplies` / `assets` (real `AssetRegistryList` /
`AssetDetailManager` / `RegisterAssetForm`, `?assetType=` filter already on `GET /v1/assets`),
`qr-scanner`, `reports`, and `WorkflowPage` slugs `fulfillment` / `custody` / `disposal` all real.
- `physical-inventory` slug → WorkflowPage MOCK — no physical-count backend (Part D #4)

### Property Officer — `app/property-officer/[[...slug]]` — PARTIAL
| Slug | State | To finish |
|---|---|---|
| `dashboard`, `assets` (+ `new` / `[id]`), `reports` | LIVE | — |
| `disposal` | WorkflowPage MOCK | add `PROPERTY_OFFICER + disposal` to `isLiveFetchPage` + widen the disposal `fetchLiveRows()` branch (copy the Property Custodian one) |
| `audit` | WorkflowPage MOCK | add `PROPERTY_OFFICER + audit` to `isLiveFetchPage` + reuse the `auditApi.list()` branch (already written for Management&Audit) |
| `corrections`, `reconciliation`, `replacements` | WorkflowPage MOCK | **new backend** — inventory corrections, physical-count reconciliation (Part D #4), replacement-validation rules (Part D #5) |

### Management & Audit Viewer — `app/management-audit/[[...slug]]` — LIVE (read-only role)
Dashboard KPIs (`reportsApi.kpi()`), all 4 report tabs (`ReportsContent`), `forms`
(`FormsArchiveContent`), and `audit` (`auditApi` via `isLiveFetchPage`) all real.
- Dashboard's 2 chart panels ("Monthly Requisition Trends", "Asset Utilization") are
  hard-coded, labeled "Preview data" — same trends/utilization endpoint gap as Management.

---

## Part C — Cross-cutting

| Item | File | Mock source | Connect to |
|---|---|---|---|
| ~~Top-bar notification bell~~ | `components/shell/TopBar.tsx` | **LIVE** (2026-08-29) — now `notificationsApi.list()`: real unread count + newest 3, refetch on open | — |
| Generic list pages | `components/prototype/WorkflowPage.tsx` | `assets/requisitions/audit/disposal/maintenance/inventory/reports/users/notifications` `.mock` via `rowsFor()` | **migration pattern (already proven ~12×):** add `role + slug` to `isLiveFetchPage`, add a branch to `fetchLiveRows()` calling the right `lib/api` client, map with the existing `*ApiToRow` helpers. Repeat per role+slug until the mock imports are unreferenced, then delete them. |

---

## Part D — Backend work that does not exist yet

1. **`assets` — custodian/assignee filter.** `GET /v1/assets` has `page,limit,search,status,assetType`. Add `custodianId` (or `assignedToMe`) so Employee "assigned assets" / dashboard can be real.
2. ~~**System Config module.**~~ **Core done — `feature/system-config`, PR pending.** Key-value `system_config` table + `GET`/`PATCH /api/v1/system-config` (admin-only, audited); SLA hours / default reorder level / useful-life years / max login attempts, read live by `requisitions.service`, the low-stock watcher, and `auth.service`. UI = **Master Admin → System Settings** (`SystemSettingsPage`); old `/admin/config` deleted. Still open: `SystemSettingsPage`'s other tabs + `reference-data` on this module; approval routes + session policy deferred.
3. **Returns / Incidents module.** Entity + endpoints for return request, repair request, damage/loss/theft report + audit logging. Consumed by Employee "Returns & Incidents".
4. **Physical count / reconciliation.** Consumed by `physical-inventory` slugs (IT Asset Custodian, Property Custodian) and Property Officer `reconciliation`; also fixes the known RPCI / RPCPPE / Physical Count Summary report gap.
5. **Replacement-validation rules.** Consumed by Property Officer `replacements` — useful-life / condition / loss-damage checks before a replacement requisition (CLAUDE.md §17).
6. **Master-Admin governance domains** (all 100 % mock in `admin.mock.ts`): access-review workflow, org-unit registry, approval-route config, custodian-coverage report, reference/master-data CRUD, system-events feed, scheduled-jobs status (may expose from `scheduler`).
7. **Trends / utilization reporting** endpoint — for the "Preview data" chart panels on the Management and Management&Audit dashboards.

---

## Suggested task split

| Owner | Scope |
|---|---|
| A | Part A dead-code deletion + move `dashboard.mock.ts` types out |
| B | `assets` custodian filter (BE) + wire Employee dashboard/assigned-assets; **Returns/Incidents module** (BE + FE tab) |
| C | **System Config module** (BE) + wire old `admin/config` + Master Admin `configuration` / `reference-data` |
| D | Master-Admin governance domains (access reviews, org units, approval config, custodian coverage, system-events, scheduled jobs) — BE + FE; then wire the 4 "Preview data" dashboard panels |
| E | `isLiveFetchPage` extensions: Approving Officer `approval-history`; Property Officer `disposal` + `audit`. (`notifications` for all roles + TopBar bell done 2026-08-29.) |
| F | **Physical count / reconciliation** (BE) + wire the `physical-inventory` slugs and Property Officer `reconciliation`; also fixes RPCI/RPCPPE reports. Replacement-validation rules + Property Officer `replacements`/`corrections`. |
| — | Trends/utilization endpoint (#7) — small, fold into D or E |

Per task: keep `NEXT_PUBLIC_USE_MOCK_DATA` working until the slice is fully real, add the
DB migration (`Database/migrations/`, `synchronize:false`), enforce the role guard, write
the audit-log entry, run `CHECKS.md` before marking done. Update **`SYSTEM-STATUS.md`**
(the plan's checkboxes are abandoned) when a slice lands.
