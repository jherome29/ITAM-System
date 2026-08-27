# Design: Port Real Backend Wiring Into the Redesigned Layout

**Date:** 2026-08-22
**Status:** Approved by user, proceeding to implementation plan

## Context

The frontend currently has two coexisting UI designs per role: an older, simpler
layout (`/it-personnel/*`, `/admin/*`, `/supervisor/*`, `/management/*`) and a
newer redesigned layout (`/it-asset-custodian/*`, `/master-admin/*`,
`/approving-officer/*`, `/management-audit/*`, `/employee/*`,
`/property-custodian/*`, `/property-officer/*`). Login and all in-app navigation
route users to the new layout exclusively — the old layout is never linked to,
only reachable by typing its URL directly.

For most roles, the new layout looks fully functional but is largely mock data
(`Frontend/lib/mock/*`, mostly self-disclosed via "frontend mock mode" toasts).
The old layout, where it still exists, is genuinely wired to the real backend.
Employee is the one role where this gap has already been closed (2026-08-21):
its new-layout dashboard and notifications were wired to real APIs, and it's
the reference example for what "done" looks like — real data, honest "Preview
data" labeling for the one section with no backend equivalent, no old-layout
page for this role at all.

The user wants the rest of the roles brought to the same state — new layout
becomes the sole, fully-real UI — as an iterative, trackable effort, with the
eventual (separate, not-yet-scheduled) goal of deleting the old layout once
each role's replacement is verified.

## Goal

Port every piece of *already-real* functionality (real backend endpoint,
reachable today from the old layout or elsewhere in the app) into its
new-layout equivalent, role by role, verifying each phase before moving to
the next.

## Explicit non-goals (separate, later work)

Do **not** build backend functionality that doesn't exist anywhere yet, even
if the new layout has a page inviting it:

- Master Admin's governance/platform pages (approval workflows, custodian
  assignments, master data, system health, org units, access reviews) — no
  backend controller exists for any of these; they stay mock, honestly
  disclosed (already fixed 2026-08-21).
- Physical count / reconciliation (Property Officer's `reconciliation` /
  `corrections` pages, and IT Asset Custodian's / Property Custodian's
  `physical-inventory` pages) — no backend mechanism exists to record or
  compare a count.
- Replacement requisition validation, disposal-workflow required fields,
  alternate-approver support, notifications/SLA automation — all confirmed
  absent from the backend in prior audits (`SYSTEM-STATUS.md`).

These stay mock/absent in this round. Bringing them to life is real product
work (new endpoints, new business rules) that needs its own design pass, not
a wiring port.

## Scope, in order

1. **IT Asset Custodian** (`/it-asset-custodian/*`) — the largest piece. Real
   backend already exists for all of it: asset registry (create/update),
   lifecycle transitions (issue/return/transfer/repair/flag-disposal), QR
   generation/lookup, requisition fulfillment (fulfill/hold), COA form
   generation, management reports, notifications.
   - Most sub-pages (fulfillment, custody, maintenance, disposal) are driven
     by the shared `WorkflowPage.tsx` prototype engine and fit the existing
     `isLiveFetchPage` pattern (already proven for Approving Officer's
     approvals queue): add the role+slug to that flag, add a row-converter,
     replace the relevant mock action branches with real API calls.
     `physical-inventory` is explicitly excluded from this list — it falls
     under the reconciliation non-goal above and stays mock.
   - The asset registry (`assets` slug) is a different file
     (`AssetInventoryGallery.tsx` / `CreateInventoryRecord`) with its own
     local mock-array state, not a `WorkflowPage.tsx` slug — this one needs a
     heavier rewrite to call `assetsApi` directly (list/create/update/
     updateLifecycle/generateQr), closer to how `EmployeeDashboard.tsx` was
     redone than a flag flip. Asset detail/edit/lifecycle actions currently
     don't exist in this component at all (only a read-only detail drawer)
     and need to be added.
   - `dashboard` renders through `RoleDashboard.tsx` (shared per-role
     dashboard, not `WorkflowPage.tsx`) — same file already touched for the
     "View All" link fix; needs the same kind of real-data wiring
     `EmployeeDashboard.tsx` got.
   - `notifications` — swap in the real shared `NotificationsContent.tsx`,
     same as the Employee fix.
   - `qr-scanner` — verify what the old `/it-personnel/qr-scan` page actually
     does before assuming a dedicated QR-lookup endpoint exists (an earlier
     audit found it's a text-search form, not real camera/QR integration).

2. **Approving Officer's dashboard** (`/approving-officer` → `RoleDashboard.tsx`)
   — small. `requisitionsApi` already used correctly elsewhere on this role;
   wire the KPI/recent-activity data the same way.

3. **Management & Audit Viewer's** remaining report tabs
   (`/management-audit/asset-reports`, `requisition-reports`,
   `maintenance-disposal`, `physical-count`, `forms`) — `audit` slug is
   already real. Need to confirm per-tab which map to existing
   `reportsApi`/`auditApi` calls before wiring (some, like `physical-count`,
   likely fall under the reconciliation non-goal above and should be
   excluded once confirmed).

4. **Property Custodian / Property Officer** — only their asset/fulfillment/
   custody pages (backend already scopes these roles to Fixed + Supplies
   asset types, confirmed working). Reconciliation/replacement-validation
   pages excluded per non-goals above.

## Tracking

No separate status document. `superpowers:writing-plans` produces a phased,
checkbox-style implementation plan — that plan file *is* the tracking
artifact. After each phase completes, the plan file gets updated in place
(marked done, next phase's status noted) rather than duplicating status in a
second file.

## Verification, every phase

Same discipline as the 2026-08-21 fix rounds: `tsc --noEmit` and `eslint
--max-warnings 0` (both Frontend and Backend if a phase touches the backend),
full test suite (`Backend`: `npx jest`; `Frontend`: `npm run test`), full
`npm run build` — before moving to the next phase, not batched at the end.

## Old-layout removal

Explicitly out of scope for this effort. A role's old-layout pages should
only be deleted after its new-layout replacement is verified working end to
end — flagged when ready, actual deletion is the user's call, done
separately per role rather than as one final bulk deletion.
