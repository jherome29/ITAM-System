# Next Time — pick up here

Where the work stands after the **2026-10-16** session, and what to do next, in
order. To get the stack running, see `RUN-LOCAL.md` §1. To verify a screen or a PDF
properly, see `RUN-LOCAL.md` §11. Update this file at the end of every session.

---

## 1. Where it stands

- **`develop`** has PR #102 / #103 (returns & incidents, repairs, replacement flow).
- **Four PRs are open and mergeable, CI green** (SonarCloud and Docker Build were still
  running on #108):

  | PR | Branch | What |
  |---|---|---|
  | #105 | `fix/audit-findings-2026-10-14` | access control, audit integrity, numbering, KPIs, deployment |
  | #106 | `feat/pilot-demo-data` | removes every mock screen (contains #105) |
  | #107 | `feat/demo-data-seed` | repeatable pilot demo data through the real API |
  | #108 | `fix/ui-audit-findings` | 12 audit defects, forms redesign, running numbers, property roles file requisitions, PDF layout fixes. **Stacked on #106** |

- Health on #108: backend 728 unit + 89 e2e, frontend 320, every `CHECKS.md` item clean.
- The shared Supabase dev DB is at schema **016** and has the new Approving Officer
  `psm.approver@cicc.gov.ph` (see `docs/guides/ROLES.md`).
- Local servers (this machine): backend `:3001` (`DB_POOL_MAX=8`) and frontend `:3000`
  are running the #108 build.

## 2. Do first

- [ ] **Get #105 → #106 → #107 → #108 reviewed and merged** (develop needs 1 review each). Retarget
      #108 to `develop` when #106 merges. Offer a short reviewer walkthrough if teammates need one.
- [ ] Check CI on #108 finished green (SonarCloud, Docker Build).
- [ ] **Fix the end-date bug in the period reports** (`getDateRange` in
      `Backend/src/reports/reports.service.ts`): an end date is midnight, so an item created
      later that day is left out of a period ending today. Small, real, needs a test first.
- [ ] **Compare the generated PDFs with `FORMS/`** — layout and content were checked on 2026-10-16,
      not the paper templates. Then the form-fidelity pass (`docs/guides/COA-FORMS-AUDIT.md`).

## 3. Decisions waiting on you or CICC

- Should the **Annex A.4** list only issued SEP items (it lists every SEP asset created in the period)?
- Should the **asset history** name the person, not the role?
- Whose section is the **Office/Section** on a PAR / ICS / RLSDDP (today: the asset's registered one)?
- CICC's **document-number series** (ours is a placeholder) and the **Fund Cluster** value.
- Whether to build **physical-count recording / reconciliation** and the **trends / utilisation**
  report (neither exists; `PATH-TO-DONE.md` §A).
- **Rotate the dev passwords** before handover; the repo is public and they are in four md files.

## 4. Clean-ups

- [ ] `PROGRESS-REPORT-DRAFT.md` and `docs/superpowers/` are untracked local files. The first is
      content for the capstone progress report (it holds the dev test accounts: do not commit it
      as is); the second is old plan/spec drafts that the status docs say were already deleted.
- [ ] Rows left in the shared Supabase DB: `[VERIFY-2026-10-14]` test assets / requests, and the
      seeder's `DEMO-` rows (PR #107). Harmless but they clutter queues; clean up before a pilot.
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
- **Each login bumps `tokenVersion`** and signs that account out everywhere else, so a scripted login
  kicks your browser session. The login route is also limited to 10 per minute per IP: a seed script
  that logs in a dozen accounts hits a 429, so retry with a wait.
- **Start a sandbox backend from a folder with no `.env`** and an explicit `DATABASE_URL`, so it can
  never read the Supabase connection string from `Backend/.env`.
- **The shared Supabase DB allows 15 connections**: run the backend with `DB_POOL_MAX=8`.
- **Schema changes need a SQL file** in `Database/schemas/` and a line in `docker-compose.yml`. The
  e2e suite uses `synchronize: true`, so it will *not* catch a missing migration.
- **Heredocs:** in Git Bash an unquoted `<<EOF` runs backticks inside it as commands. Quote the
  delimiter (`<<'EOF'`), or write the file with the editor and run it.
- **PowerShell 5.1 mangles double quotes in native arguments.** Use `git commit -F <file>`.
- **One unreproduced test failure:** 4 tests in `auth.service.spec` (lockout threshold) failed once on a
  coverage run and passed in the next four runs. If it recurs, capture the output.
