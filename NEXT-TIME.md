# Next Time — pick up here

Where the work stands after the **2026-10-16 and 2026-10-17** sessions, and what to do next, in
order. To get the stack running, see `RUN-LOCAL.md` §1. To verify a screen or a PDF
properly, see `RUN-LOCAL.md` §11. Update this file at the end of every session.

---

## 1. Where it stands

- **`develop` has everything built so far.** #105, #106, #107 and #109 were merged on
  2026-10-16. (#108 had been merged into the already-merged `feat/pilot-demo-data`
  branch by mistake, because its base was not retargeted after #106 merged, so #109
  delivered the same work into `develop`. When you stack PRs, check the base reads
  `develop` before you click merge.)
- **`main` is still behind `develop`.** Promoting it needs 2 reviews and every check green
  (`secret-scan`, `codeql`, `dependency-audit`, `owasp-dc` included).
- **The Property Officer role was merged into the Property Custodian** on branch
  `refactor/merge-property-officer-into-custodian` (this PR): the Officer was a read-only
  subset of the custodian. Schema `017` migrates its accounts; the `property_officer`
  value stays in the Postgres and shared enums (deprecated: old audit rows carry it); no
  route grants it and the API refuses to assign it; Replacement Validation and Disposal
  Review are now in the Property Custodian's menu.
- **UI consistency and bigger text** is on branch `refactor/ui-consistency` (pushed, **no PR yet**). It is stacked on #110 (the Property Officer merge) and the two shell-branding commits, so it must wait for #110 and its PR base must read `develop`. Why: the client asked for bigger text after the last demo, and the screens were built one at a time (eight ways to print a date, six page titles, four input styles, three status badges, five filter rows). Now: the type scale lives in `Frontend/app/globals.css` (nothing below 14px, body 16px, controls 44px, sidebar 288px), the shared kit is `Frontend/components/ui/` (CLAUDE.md §16 has the "you need X, use Y" table), and `Frontend/lib/ui-consistency.spec.ts` fails the build when a screen goes around it. Five commits: dates and money helpers, type scale, form kit and filter row, chips / cards / panels / notices / dialogs and wording, then spacing and docs. Then a page-by-page audit: every menu page of all six roles (61) plus the add-new forms, record pages and the drawers and dialogs behind the queues, on a throwaway database filled by `npm run seed:demo` (both rounds), at 1440 and 1366 wide. It found what the first pass could not: 16 tables wider than their panel (the Actions column and its buttons hidden behind a sideways scroll), button labels wrapping out of their buttons, raw codes in cells (`system_admin`, `serviceable`, `pending supervisor`), a role name cut off in the sidebar footer and request numbers breaking across lines. All fixed, and re-measured: no scroll container overflows at either width. Not covered: the PDFs (unchanged by this work), and a real phone or tablet (only emulated at 390 and 820 wide).
- **A second pass on the same branch (2026-10-17): lots of data and very long names.** Run against a throwaway database with about 350 users, 800 assets, hundreds of requests and 2,700 audit rows, and with names and descriptions of 90 to 690 characters, then every page of all six roles, the drawers of the nastiest records, every form and report, and the API over a database built from `Database/schemas/*.sql` (recipe: `RUN-LOCAL.md` §11). It found and fixed, each with a test first: (1) lists that **silently showed only the first 15 / 50 / 100 / 200 records**: My Requisitions (15), the user directory (50, now paged by the server), Roles & Assignment (100, so nobody after them could be given a role), Approval History (200, with wrong totals) and Disposal Review (500); (2) long lists rendered every row and stalled the browser 1-2 s, now 25 a page (`Pager`, `usePaged`), about 150 ms; (3) a long description made a column collapse to one letter wide, because `overflow-wrap: anywhere` lets a column shrink without limit (headers now keep their words, `ClampText` has a ceiling width) and `ClampText` itself did not clamp (`block` switched `line-clamp` off); (4) **management-report PDFs printed wrapped cells over the next row and added stray pages** (Audit Trail: 171 pages, 84 stray; Asset Master List was garbled even with ordinary data), now the same `drawTable` as the COA forms on a landscape page, with cost as `PHP` not `±`; (5) form header lines (`drawMetaFields`, PTR's From / To) that wrapped over the next line; (6) **the API returned a bare 500** for a value one character over its column, a body over the size limit and a duplicate property number / employee ID, because the sandbox's entity-built columns are unbounded and hid it: now field-limit DTOs (`common/field-limits.ts`) plus 400 / 409 / 413 in the exception filter; (7) the audit CSV now defuses formula cells and carries a byte-order mark. Not tested, by decision: phone widths (the system is used on the web).
- Health: backend 900 unit + 94 e2e tests, frontend 494, every `CHECKS.md` item clean (the production `next build` was not re-run on this branch because `next dev` holds `.next`; CI builds it).
- **The shared Supabase dev DB is at schema 017** (applied 2026-10-16: it moved the one Property Officer account to Property Custodian; that account was renamed `property.custodian2@cicc.gov.ph` the same day).

## 2. Do first

- [ ] **Look at `refactor/ui-consistency` yourself** (the dev server on `:3000` already serves it if you are on the branch): the registry and Custody & Issuance filter rows, the Register Asset form, the employee dashboard, Audit Log date range, a lifecycle update (it is now a dialog that closes on Escape), and the screens at a narrow width. Tell us what still reads wrong; the rules are cheap to change in one place.
- [ ] Open its PR into `develop` once #110 is merged (check the base before you click merge).
- [ ] **Restart your `:3001` backend.** `Backend/dist` was rebuilt on disk for the 2026-10-17 fixes (report PDFs, form header lines, field limits, 400 / 409 / 413) but the process on `:3001` was left running on the old bundle. Restart it the usual way (`DB_POOL_MAX=8`, RUN-LOCAL §1). Until then Supabase-backed screens still show the old behaviour for those.

- [x] Schema 017 applied to the shared Supabase dev database (2026-10-16) and the local backend
      (`:3001`, `DB_POOL_MAX=8`) restarted on the new build. Check it yourself: sign in as
      `property.custodian2@cicc.gov.ph` and you should land on the Property Custodian dashboard.
      Any other database still needs 017 before it runs this backend.
- [ ] **Look at SonarCloud's failing quality gate** ("C Reliability Rating on New Code",
      required ≥ A; it failed on #106, #107 and #108, passed on #105). The issue is not
      identified: SonarCloud's API refuses non-main branches for this organisation, so open
      `https://sonarcloud.io/dashboard?id=jherome29_ITAM-System` and read the issue, then fix it.
- [ ] **Fix the end-date bug in the period reports** (`getDateRange` in
      `Backend/src/reports/reports.service.ts`): an end date is midnight, so an item created
      later that day is left out of a period ending today. Small, real, needs a test first.
- [ ] **Compare the generated PDFs with `FORMS/`**: layout and content were checked on
      2026-10-16, not the paper templates. Then the form-fidelity pass
      (`docs/guides/COA-FORMS-AUDIT.md`).
- [ ] Promote `develop` → `main` when you are happy.

## 3. Decisions waiting on you or CICC

- **Native calendar or a custom one?** Every date box is now one styled `DateField`, but the pop-up is still the browser's own, and its displayed format (dd/mm/yyyy or mm/dd/yyyy) follows each viewer's browser setting. A custom calendar would show one format everywhere but adds a small library and changes how the calendar looks. Not done; ask CICC whether the format matters to them.
- **Where the screens say "newest N" instead of paging.** The audit log shows the newest 200 events (it says so, and narrowing the dates reaches older ones) and its search box only searches those; the notification inbox shows the newest 50; the employee catalogue is capped by the API at 100 grouped items and now says so. A real fix is server-side paging and search for the audit log (the API already pages; it has no text search). Worth it before a COA audit? Your call.
- **Stop typing at the limit?** The API now refuses an over-long value with a message that names the field, which the forms show. The inputs themselves do not yet stop at 100 / 200 characters (`maxLength`); that needs the limits in `packages/shared` so the browser and the API read one number.
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
