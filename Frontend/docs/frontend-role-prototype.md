# Frontend Role Prototype

This phase implements the proposed role-based experience on the frontend only.

## Implemented In Frontend

- Proposed frontend roles live in `lib/roles/proposed-roles.ts`.
- Backend-to-proposed role mapping lives in `lib/roles/role-mapping.ts`.
- Role navigation and UI permissions live in `lib/roles/role-navigation.ts` and `lib/roles/role-permissions.ts`.
- Mock dashboard, asset, requisition, user, and workflow data live in `lib/mock`.
- The development role switcher is hidden when `NODE_ENV=production`.

## Current Mock Data

The redesigned dashboards, KPI cards, charts, requisition queues, asset snapshots, activity rows, inventory discrepancies, low-stock alerts, and useful-life alerts use mock data while backend support is deferred.

## Deferred Backend And Database Work

- Database role migration.
- New role tables or multiple-role support.
- Backend permission policies.
- Backend asset-type and organizational-unit authorization.
- Approval delegation logic.
- Transactional fulfillment changes.
- Disposal authorization backend.
- Production API changes for role-specific dashboards.
- Secure enforcement of the proposed permissions.

Frontend checks in this phase are for navigation, route presentation, button visibility, read-only states, and demonstration only. Secure enforcement still belongs to the backend/database phase.

