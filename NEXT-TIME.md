# Next Time — pick up here

Where the `feature/returns-incidents-and-workflow-fixes` branch stands after the
2026-10-11 session, and what to do next, in order. To get the stack running, see
`RUN-LOCAL.md` §1 (Docker Desktop → `docker compose --env-file .env.docker up -d postgres` →
`npm run dev`, from **PowerShell**).

---

## 1. Ship what is already built (do first)

- [x] **Open the PR `feature/returns-incidents-and-workflow-fixes` → `develop`.**
      Open as **#102**, every CI check green; needs 1 review. (`gh`'s active
      account token is still invalid — the `dreiiiiim` account works.)
- [x] **Apply migrations to shared Supabase** — done 2026-10-11 through `008`–`014`
      (001–008 were already there; 009–014 applied via the claude.ai Supabase
      connector's `apply_migration`, since the `supabase` MCP is read-only).
      Teammates: every older local Docker Postgres still needs 009–014. Locally:
      ```powershell
      docker cp "Database\schemas\013_asset_repairs.sql" aimrs_postgres:/tmp/m.sql
      docker exec aimrs_postgres psql -v ON_ERROR_STOP=1 -U aimrs_user -d aimrs_dev -f /tmp/m.sql
      ```
      It is safe to re-run. Without it, the backend fails on any `asset_repairs`
      query and on the new notification and audit enum values.
- [x] **Sync the status docs** (done, commit `87db318`) with what this branch added: `FEATURE-STATUS.md`,
      `PATH-TO-DONE.md`, `TEAM-HANDOFF.md` §4–5. CLAUDE.md is already updated
      (Module 2 request types + replacement flow, Module 6 one-case-per-item,
      Module 7 Maintenance & Repair).

## 2. What this branch added (for the PR description and reviewers)

| Area | Change |
|---|---|
| Requisitions | Request type is derived, never picked by hand. A "repair" requisition is refused. Replacement starts from My Assigned Assets only, after an eligibility check. Fulfilling a replacement takes the old unit back and generates its receipt. |
| Returns & Incidents | My Assigned Assets for **every** role. Server-computed `canAct`. System Admin is the fallback decider for a custodian's own request. A loss/theft report supersedes a pending hand-over. Per-type date wording. Confirmation step before filing. |
| Repairs (new, schema 013) | Repair record per stay `under_repair`. Maintenance & Repair queue for both custodians. Outcome repaired / not repairable. Condition follows the lifecycle. Holder notified. Overdue watcher (`repair_overdue`). Repair History report. |
| Deps | next 16.4.0. Non-breaking audit fix. `braces` allowlisted (no fix exists; lint tooling only). |

## 3. Next features — built 2026-10-11 on `feature/replacement-repair-followups`

- [x] **Repeat repairs as a replacement reason.** Example: repaired ≥ N times in 12 months.
      Add it to `Backend/src/assets/replacement-eligibility.ts` with the count from
      `asset_repairs`, and make N a system-config value. The Property Officer's
      "Replacement Validation" page (`/property-officer/replacements`) is still
      mock data and could show this.
- [x] **Loaner unit while an item is under repair.** (schema `014`) Today the holder has to file
      a normal requisition with an expected return date. Option: on the repair
      drawer, "Issue loaner", which issues an available unit with a return date
      and links it to the repair, then prompts its return when the repair closes.
- [x] **Issue the new unit when a replacement is fulfilled.** `fulfill()` returns
      the old unit, but the new one is still issued separately through Custody &
      Issuance (fulfil only links the item). Consider issuing it in the same step.
- [x] **Requester access to the replacement receipt.** The receipt is generated
      and linked to the requisition (`related_requisition_id`), but only the
      custodian sees it (Reports & Forms). Add a download on the requisition
      detail, like Returns & Incidents documents.
- [x] **Admin dashboard watcher panel.** It shows only the last sweep time and
      trigger. Show per-watcher counts, including the new `overdueRepairs`.

## 4. Clean-ups

- [x] **Dead code in `Frontend/components/prototype/WorkflowPage.tsx`.** The IT
      Asset Custodian `maintenance` slug is now routed to `RepairQueue`, so the
      `isItAssetCustodianLiveMaintenance` / `submitMaintenanceDecision` path is
      unreachable. Remove it and its mock rows.
- [x] **Most e2e specs build the app without `main.ts`'s global
      `ValidationPipe`**, so DTO rules are not exercised there. `repairs.e2e-spec.ts`
      and `security.e2e-spec.ts` add it explicitly. Consider a shared
      `createTestApp()` helper that mirrors `main.ts`.
- [ ] **Leftover E2E rows in the local dev DB** (`[E2E-DOCS-…]` cabinets, under
      repair / flagged). Harmless, but they clutter the queues. Reset with
      RUN-LOCAL.md §6 if wanted.
- [x] **Employee dashboard tiles marked "PREVIEW DATA"** are still mock data. See
      `MOCK-DATA-WIRING.md`.

## 5. Still open from the wider plan (see `PATH-TO-DONE.md`)

- COA form correctness pass (`docs/guides/COA-FORMS-AUDIT.md`).
- Phase 5: JMeter run at 362 users, UAT instrument, OWASP ASVS checklist.
- Promote the CI `docker-build` job to a required check on `main` once it has
  been green for a while.
- Production readiness: blocked on CICC server access.

## 6. Gotchas learned this session

- **Run npm from PowerShell, not Git Bash** (bcrypt native build; see RUN-LOCAL.md §5).
- **Windows PowerShell 5.1 mangles double quotes in native arguments.** Use
  `git commit -F <file>` for messages that contain quotes.
- **`npm run build` in `Frontend/` shares `.next/` with the dev server.** Stop
  `npm run dev` first and restart it afterwards.
- **Each login bumps `tokenVersion`** and signs that account out everywhere else.
  Scripted logins kick your browser session.
- **Schema changes need a SQL file** in `Database/schemas/` and a line in
  `docker-compose.yml`. The e2e suite uses `synchronize: true`, so it will *not*
  catch a missing migration.
