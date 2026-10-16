# Mock Data → Real Wiring — Status

**Snapshot:** 2026-10-16 (still true; the table below was extended for the property roles). **The frontend contains no mock or sample data.** Every
screen a user can reach reads real records from the API, and every button on it saves
through the API (and is audited). This file used to be the migration map; the migration
is finished, so it is now just the record of what that means and what is *not built*.

## What was removed

| Was | Now |
|---|---|
| `Frontend/lib/mock/*.mock.ts` (12 files), `lib/services/mock-*.service.ts` (5) | deleted |
| `appConfig.useMockData` / `NEXT_PUBLIC_USE_MOCK_DATA`, `enableRolePreview` | deleted — there is no mock mode to switch on |
| Sample branches of `components/prototype/WorkflowPage.tsx` (made-up `REQ-2025-0xx`, `INV-001`, "Mock QR Scanner", the fake "accountability ledger", `runAction` → "completed in frontend mock mode") | deleted; the component now serves only the live pages listed below |
| `LaptopAssetForm/Detail`, `AssetInventoryGallery`, `InventoryLabelPrinter`, `RoleDashboard`, chart/KPI widgets, `FormDialog`, `ActivityTimeline`, `RoleRouteGuard`, `PermissionGate` | deleted — nothing rendered them |
| The hard-coded charts on the old `/management/dashboard` (Mar–Jun request counts, "45 laptops, 67%") | that address now redirects to `/management-audit/dashboard` |

## What serves each page

`lib/workflow/live-pages.ts` is the allow-list of pages `WorkflowPage` may serve; the
role routers return *not found* for anything else (`lib/workflow/live-pages.spec.ts` pins the list), so an address with no real screen
behind it can never show a made-up one.

| Page | Roles | Reads / writes |
|---|---|---|
| Approval Queue | Approving Officer | `GET /v1/requisitions`, `…/approve`, `…/reject` |
| My Requisitions | Approving Officer, IT Asset Custodian, **Property Custodian, Property Officer** (the Employee has its own pages) | `GET /v1/requisitions/mine`, `POST /v1/requisitions` |
| Requisition Fulfillment | IT Asset Custodian, Property Custodian | `GET /v1/requisitions` (their own requisitions are excluded), `…/fulfill`, `…/hold` |
| Requisition Fulfilment (fallback) | **Master Admin** | `GET /v1/requisitions/fulfilment-fallback` (only requisitions a custodian filed themselves), `…/fulfill`, `…/hold` |
| Custody & Issuance | IT Asset Custodian, Property Custodian | `GET /v1/assets` (carries who holds each asset), `PATCH …/lifecycle` |
| Disposal Recommendations | IT Asset Custodian, Property Custodian | `GET /v1/assets?status=available`, `PATCH …/lifecycle` |

Everything else is its own component calling the API directly (dashboards, asset registry,
returns & incidents, maintenance & repair, replacement validation, disposal review,
physical-inventory count sheet, reports, forms archive, notifications, Master Admin,
and Management's Audit Log — the same append-only viewer the Master Admin uses).

## Not built (so not offered)

These have **no backend**, so their menu entries were removed rather than left as
sample screens:

- Inventory corrections and reconciliation workflows (Property Officer)
- *Recording* a physical count (the count sheet is read-only against live assets)
- Trends / utilisation reporting (the Management dashboard shows real status shares,
  not monthly trends)
- The Master-Admin governance domains cut on 2026-09-09 (access reviews, org-unit
  registry, approval-route config, custodian coverage)

If one of these is built, add its page to `live-pages.ts` (or give it its own component)
and its menu entry to `lib/roles/role-navigation.ts` — nothing else needs un-hiding.

## The pre-redesign shells are gone

`/admin`, `/supervisor`, `/it-personnel` and `/management/*` (29 files, plus the six shared
components only they used) were deleted on 2026-10-15. Login had stopped sending anyone
there, and every capability had a new equivalent except one: the IT custodian's
management-report generator (`/it-personnel/reports`). That now lives at
`/it-asset-custodian/management-reports`, in the IT menu. The Property Officer's "Go to Forms"
button, the only link from a new screen into an old one, now points at
`/property-officer/reports`.
