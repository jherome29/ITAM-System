# Next Time — pick up here

Where the work stands after the **2026-11-25 → 2026-11-28** session, and what to do next, in
order. To get the stack running, see `RUN-LOCAL.md` §1. To verify a screen or a PDF
properly, see `RUN-LOCAL.md` §11. Update this file at the end of every session.

---

## 0. This session, in order

1. Continued functional testing across modules (asset lifecycle, requisitions, returns,
   repairs, disposal) as the Employee/Supervisor/custodian roles via Playwright + the shared
   Supabase dev database.
2. Found and fixed three real bugs, each with a test: approver's name showing "Not yet
   assigned" right after submit (`requisitions.service.ts` `create()` wasn't hydrating the
   relation); PAR/ICS never auto-generated on requisition fulfilment (nothing called
   `reportsService.generateFormRecord()` from `fulfill()`/`recordHandover()`/
   `issueReplacementUnit()`); a React key-collision console warning (two sibling components
   sharing a literal key in `RequisitionDetailView.tsx` and `RepairQueue.tsx`).
3. Consolidated the `UPDATED-ROLE-ASSET-CUSTODIAN` branch (the IT Personnel + Property
   Custodian → **Asset Custodian** role merge, already deployed to Railway, plus the CICC
   real-equipment import) into `develop`, via PR #116 and three small fix PRs (#113–115),
   fixing CI failures along the way: a retired-role regression, 13 high-severity dependency
   advisories, and a CodeQL duplicate-webpack-key warning.
4. Fully re-verified `develop` after the merge: every `CHECKS.md` step, a browser functional
   pass, a k6 re-run (p95 now 1.04 s, up from 758 ms in September — `perf/README.md`).
5. Updated every markdown file in the repo to match the above, found and fixed two more small
   issues along the way (`docker-compose.yml` was missing schema `021` from its init list; this
   file and others still described the pre-merge 6-role model), and found one real product
   regression while doing so (next section).

## 1. Where it stands

- **`develop` has everything built so far, including the Asset Custodian merge** (see §0
  above and CLAUDE.md §4 / `docs/guides/ROLES.md` for the full detail). Everything from the
  2026-10-16/17 sessions (returns & incidents, maintenance & repair, UI consistency + bigger
  text, record printouts, the Administration Overview) is also in `develop` — full history in
  `SYSTEM-STATUS.md`'s dated log, not repeated here.
- **`main` is still behind `develop`.** `develop` is fully re-verified (CHECKS.md, browser pass,
  k6) and green on every required CI check — opening the PR is the very next step, not blocked
  on anything. Promoting needs 2 reviews and every check green (`secret-scan`, `codeql`,
  `dependency-audit`, `owasp-dc` included; `SonarCloud`'s Action-step check passes — the
  separate `SonarCloud Code Analysis` quality-gate status still fails but is confirmed **not**
  a required check for `main`, see the ruleset).
- **The shared Supabase dev DB is at schema `019`, not `021`** — confirmed directly
  (`requisition_items.asset_class` is still `NOT NULL` there). Apply `021` before testing a
  manually-entered requisition line against it.
- Health (2026-11-28, full re-run on merged `develop`): backend 985 unit + 121 e2e tests,
  frontend 538, every `CHECKS.md` item clean including both production builds, Docker build
  for both images, and smoke tests. k6 p95 is now 1.04 s (was 758 ms in September) —
  `perf/README.md` has the detail; not confirmed yet whether that's real regression or just
  this run's contention.

## 2. Do first

- [ ] **Open the `develop` → `main` PR.** `develop` is already re-verified and green; nothing
      is blocking this. After it merges, repoint Railway's deploy branch from
      `UPDATED-ROLE-ASSET-CUSTODIAN` to `main`.
- [ ] **Apply schema `021`** to the shared Supabase dev database (it's at `019`) before testing
      a manually-entered requisition line with no asset class against it.
- [ ] **Decide the Replacement Validation / Disposal Review regression**, found while updating
      these docs: both screens now redirect into Fulfillment / Disposal (2026-11-26, "retire
      redundant navigation"), which don't show held items that qualify for replacement with no
      open request yet. The backend endpoint and `ReplacementReview.tsx` both still exist, just
      unreachable. Restore a screen (maybe on Master Admin or Management, who never had one
      either), or confirm the loss is acceptable.
- [ ] **Tighten `ASSIGNABLE_USER_ROLES`**: `it_personnel` and `property_custodian` are still
      technically assignable via a direct API call (only the frontend dropdown hides them,
      unlike the hard-blocked `property_officer`). Decide whether to close that, the same way
      `property_officer` was closed.
- [ ] Branch cleanup (joint decision, not unilateral): ~30 stale branches beyond the merged
      ones, plus local-only `.worktrees/` and `.superpowers/` directories (gitignored, tied to
      old branches `fix/approving-officer-real-actions`, `fix/auth-all-roles-missing-property-roles`,
      `fix/supervisor-approval-workflow`, `fix/users-audit-logging`, `docs/update-team-handoff-post-merge`
      — check whether they hold anything worth keeping before removing them).
- [ ] **Fix the end-date bug in the period reports** (`getDateRange` in
      `Backend/src/reports/reports.service.ts`): an end date is midnight, so an item created
      later that day is left out of a period ending today. Small, real, needs a test first.
- [ ] **Compare the generated PDFs with `FORMS/`**: layout and content were checked on
      2026-10-16, not the paper templates. Then the form-fidelity pass
      (`docs/guides/COA-FORMS-AUDIT.md`).
- [ ] Do the CD plan in `docs/guides/CD-PLAN.md` — item 1 (the migration runner) is done; items
      2–7 (security gates that actually block, a promotion branch, a dependable smoke test,
      rollback drills, secrets hygiene, production handover) are still open.

## 3. Decisions waiting on you or CICC

- **Native calendar or a custom one?** Every date box is now one styled `DateField`, but the pop-up is still the browser's own, and its displayed format (dd/mm/yyyy or mm/dd/yyyy) follows each viewer's browser setting. A custom calendar would show one format everywhere but adds a small library and changes how the calendar looks. Not done; ask CICC whether the format matters to them.
- **Where the screens say "newest N" instead of paging.** The audit log shows the newest 200 events (it says so, and narrowing the dates reaches older ones) and its search box only searches those; the notification inbox shows the newest 50; the employee catalogue is capped by the API at 100 grouped items and now says so. A real fix is server-side paging and search for the audit log (the API already pages; it has no text search). Worth it before a COA audit? Your call.
- **Stop typing at the limit?** The API now refuses an over-long value with a message that names the field, which the forms show. The inputs themselves do not yet stop at 100 / 200 characters (`maxLength`); that needs the limits in `packages/shared` so the browser and the API read one number.
- **The layout of the paper copy.** CICC gave no template, only "a printable", so ours is a first version: header and seal, facts, items, steps, signature lines, verification code and a `PR-YYYY-NNNN` number. Ask whether they have a template, their own number series, or want other signature lines. The generator is `Backend/src/reports/forms/record-print.generator.ts`; the series is in `document-numbers.ts`.
- **Is 16px body text big enough for CICC's older staff?** It is 14% above the usual. One line in `globals.css` (`--text-sm`) changes the whole system; ask them at the next demo.

- Should the **Annex A.4** list only issued SEP items (it lists every SEP asset created in the period)?
- Should the **asset history** name the person, not the role?
- Whose section is the **Office/Section** on a PAR / ICS / RLSDDP (today: the asset's registered one)?
- CICC's **document-number series** (ours is a placeholder) and the **Fund Cluster** value.
- Does CICC want an independent **approver for disposals and replacements**? The merged-away
  Property Officer could have become that gate; if CICC wants one, the role has to be re-added.
- Whether to build **physical-count recording / reconciliation** and the **trends / utilisation**
  report (neither exists; `PATH-TO-DONE.md` §A).
- **Rotate the dev passwords** before handover; the repo is public and they are in four md files.

## 4. Clean-ups

- [ ] `scripts/audit-allowlist.mjs` still lists four `multer` advisories that no longer apply
      (`multer` is 2.4.0, the Backend audit has 0 allowlisted). Drop them.
- [x] `docs/superpowers/` (untracked local plan/spec drafts for property-roles, system-config and
      alternate-approver — all three features long since merged) deleted 2026-11-28, the same way
      the 2026-08-22 one already had been. `PROGRESS-REPORT-DRAFT.md` stays — it's content for the
      capstone progress report and holds the dev test accounts, so never commit it as is.
- [ ] `.worktrees/` and `.superpowers/` (both gitignored, local-only) hold old checkouts of
      branches `fix/approving-officer-real-actions`, `fix/auth-all-roles-missing-property-roles`,
      `fix/supervisor-approval-workflow`, `fix/users-audit-logging` and
      `docs/update-team-handoff-post-merge` — check what's in them before removing (§2 above).
- [x] The `[VERIFY-2026-10-14]` test data was removed from the shared Supabase DB on 2026-10-18 (5 assets,
      23 requisitions, 8 requests, 4 repairs, 4 forms, 75 notifications; a full backup is in
      `Desktop\AIMRS-VERIFY-data-backup`; the 49 audit entries about them cannot be deleted, the audit log
      is append-only). **Still there: the same rows on the Railway UAT database** (it was copied from Supabase
      before), where officers see them (two available units in the catalogue, 23 old requisitions under
      `employee@cicc.gov.ph`). Removing them needs the Railway database's public URL; the script is the same
      one (dry run first, then `--apply`).
- [ ] The seeder's `DEMO-` rows (PR #107) are still in Supabase. Harmless but they clutter queues; clean up
      before a pilot.
- [ ] Frontend `lifecycle-transitions.ts` duplicates the backend `VALID_TRANSITIONS`; moving it
      into `packages/shared` would remove the drift risk.
- [ ] A manual flag-for-disposal through the lifecycle endpoint leaves `condition` untouched, so an
      IIRUP can say "Serviceable".

## 5. Still open from the wider plan (see `PATH-TO-DONE.md`)

- Phase 5: JMeter at 362 users, OWASP ZAP, UAT with CICC, the ASVS report, a Frontend coverage gate.
- Production readiness (blocked on CICC server access), data onboarding, handover.

## 6. Gotchas learned

- **Run npm from PowerShell, not Git Bash** for installs (bcrypt native build; `RUN-LOCAL.md` §5).
- **Next 16 allows one `next dev` per project folder.** A second one refuses to start ("existing
  server at :3000"). To run a sandbox frontend, stop the real one first and restart it after.
- **`npm run build` in `Frontend/` shares `.next/` with the dev server.** Stop `npm run dev` first.
  After deleting a route, `tsc` can fail on stale generated types in `.next/types`; that folder is a
  gitignored build cache, so delete it (or rebuild) and re-run.
- **Each login bumps `tokenVersion`** and signs that account out everywhere else, so a scripted login
  kicks your browser session. The login route is also limited to 10 per minute per IP: a seed script
  that logs in a dozen accounts hits a 429, so retry with a wait.
- **Start a sandbox backend from a folder with no `.env`** and an explicit `DATABASE_URL`, so it can
  never read the Supabase connection string from `Backend/.env`.
- **The shared Supabase DB allows 15 connections**: run the backend with `DB_POOL_MAX=8`.
- **Schema changes need a SQL file** in `Database/schemas/` and a line in `docker-compose.yml`. The
  e2e suite uses `synchronize: true`, so it will *not* catch a missing migration. Test a data
  migration yourself: apply 001…NNN to a fresh database, insert the rows it touches, run it twice.
- **The e2e hooks are slow** (real bcrypt, real logins). Jest's default 5 s timeout made them flaky
  on a busy machine, so `Backend/test/jest-e2e.json` sets a 30 s `testTimeout`.
- **Heredocs:** in Git Bash an unquoted `<<EOF` runs backticks inside it as commands. Quote the
  delimiter (`<<'EOF'`), or write the file with the editor and run it.
- **PowerShell 5.1 mangles double quotes in native arguments.** Use `git commit -F <file>`.
- **One unreproduced test failure:** 4 tests in `auth.service.spec` (lockout threshold) failed once on a
  coverage run and passed in the next four runs. If it recurs, capture the output.
