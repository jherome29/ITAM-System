# CD plan: the best-practice version (to do after the quota reset)

Written 2026-10-17. UAT is already deployed and the officers can test it (`DEPLOY-UAT.md`). This is the
work that turns the quick setup into a proper, safe delivery pipeline. None of it blocks the officers.

## Where it stands

| Part | State |
|---|---|
| Deploy | Railway rebuilds `backend` and `frontend` on every push to the watched branch (today `refactor/ui-consistency`; move to `develop` after the PRs merge) |
| Gate in front | Cloudflare Worker with a shared password (`docs/guides/uat-gate-worker.js`); Access needs a card and a domain |
| Verification | `.github/workflows/uat-smoke.yml` (waits for the new build, then 39 checks as all six roles). Pushed. Needs the `uat` GitHub Environment and its two secrets (`UAT_BASE_URL`, `UAT_ACCOUNTS`) before it can pass |
| Production | `deploy.yml` is still the placeholder for the CICC-managed host |

Draft work that exists but is **untested and uncommitted** (untracked files, change nothing live):
`Backend/scripts/db-migrate.mjs` (the migration runner) and `Backend/test/db-migrate.e2e-spec.ts` (its e2e test).
Finish and prove them (item 1) before committing; do not commit them as they are.

## What "best practice" means here, and the work to get there (in this order)

### 1. Database migrations run with every deploy (most important)
Today a schema file merged with the code never reaches the UAT database; the backend would break against old tables.
- Finish `db-migrate.mjs`: applies `Database/schemas/NNN_*.sql` once each, in order, tracked in `schema_migrations`; an advisory lock so two
  instances cannot race; no wrapper transaction (several files use `ALTER TYPE ... ADD VALUE`); refuses a database that has tables but no history
  unless `MIGRATE_BASELINE` is given; warns (does not fail) when an applied file changed.
- Prove it: `cd Backend && npm run test:e2e:local -- db-migrate` (needs Docker). Four cases are written: empty database gets every file, a second run does
  nothing, tables-without-history is refused, baseline records without running. Fix whatever the first real run shows (the risk is a schema file that fails
  as one multi-statement query on an empty database).
- Wire it: `Backend/Dockerfile` production stage must `COPY Database ./Database` and `COPY Backend/scripts ./Backend/scripts`; set Railway's `backend`
  **Pre-deploy command** to `node scripts/db-migrate.mjs`. On the existing UAT database run it once with `MIGRATE_BASELINE=017` (17 files are already applied).
- Add the rule to CLAUDE.md section 11 #20 (a schema change is one new numbered file; never edit an applied one) and to `Database/README.md`.
- Done when: a new schema file merged to `develop` reaches UAT without anyone touching the database, and the smoke test is green.

### 2. Security checks that actually gate
`security.yml` already runs on `develop` (secretlint, CodeQL, dependency audit, OWASP) but nothing forces it to pass.
- GitHub: Settings > Branches > `develop` rule > require status checks: add `secret-scan`, `codeql`, `dependency-audit` (and `owasp-dc` if it is fast enough)
  next to the existing `backend-ci`, `frontend-ci`, `backend-e2e`, `shared-pkg`.
- Add an image scan to `ci.yml`'s `docker-build` job: Trivy on both images, fail on HIGH/CRITICAL with a fixed version. Pin the action by commit
  (`gh api repos/aquasecurity/trivy-action/git/ref/tags/<latest>`), like every other action here. Keep a short allowlist file with a reason per entry, as
  `scripts/audit-allowlist.mjs` does.
- Decide: should a red security check block the Railway deploy? Best practice yes (see item 3).

### 3. Deploy only what passed, and be able to stop it
Railway's own "Wait for CI" waits for every check on the commit, and SonarCloud's quality gate has been red for weeks, so it can stall for ever.
Pick one and write the decision into `DEPLOY-UAT.md`:
- **A. Fix Sonar** (identify the "C Reliability Rating on New Code" issue; see NEXT-TIME.md) and keep Wait for CI on. Simplest, if the gate goes green.
- **B. Deploy from a promoted branch.** A manual `promote-uat.yml` (Actions > Run workflow, pick a ref) that checks the required checks passed on that
  commit, then moves a `uat` branch to it; Railway watches `uat`. Gives a freeze during test windows, a one-click rollback (promote an older commit) and
  an approval point (GitHub Environment `uat` with a required reviewer). No Railway credentials in GitHub.
Recommendation: B once real testers are using it; A is enough until then.

### 4. Make the smoke test dependable
- Dedicated smoke accounts (not the published `ROLES.md` logins) so changing a password cannot turn the run red.
- Create the `uat` Environment, add `UAT_BASE_URL` (the Railway frontend address, no trailing slash) and `UAT_ACCOUNTS` (one JSON line, six roles).
- Add the attachment upload (15 MB through the Next proxy) and a session-refresh check to `Backend/test/uat-smoke.mjs`; both are still manual.
- Failure notice: GitHub emails the pusher; add a repository watch or a chat webhook if the team wants more.

### 5. Rollback and recovery, written down and tried once
- Rollback runbook in `DEPLOY-UAT.md`: Railway > service > Deployments > the last good one > Redeploy; or `git revert` and push; or (if item 3B) promote the old commit.
- Database: Railway volume backups only restore into the same project, with no cross-region copy. Add a nightly `pg_dump` to a private place (a scheduled
  workflow storing an encrypted artifact, or R2) and test one restore. Migrations are forward-only: a bad one is fixed by a new file.
- Try it once on UAT: break something on purpose, roll back, time it.

### 6. Secrets and access hygiene
- Replace the published test passwords with unique ones before real officers use it; create one account per officer and role. Never put the published
  list on a reachable site once testing is real.
- Rotate `JWT_SECRET` / `JWT_REFRESH_SECRET` at handover. Keep `GATE_PASSWORD` / `COOKIE_SECRET` only in the Worker. Remove the Postgres public address after
  any maintenance (it was switched on and off several times).
- When a domain exists: replace the Worker password gate with Cloudflare Access (one-time PIN per officer email), set SSL mode Full, delete the generated
  `*.up.railway.app` address so the gate cannot be bypassed, and recheck `TRUST_PROXY` against the audit-log IP.
- Dependabot (or Renovate) for the GitHub Actions pins and the Dockerfile base images.

### 7. Production handover (CICC-managed host)
The same two images are what CICC runs. Prepare: `deploy.yml` filled in for their server (SSH or their registry), the pre-deploy migration step
(`node scripts/db-migrate.mjs` with their `DATABASE_URL`), `docker-compose.prod.yml` env list (already documented), TLS and the proxy hop count
(`TRUST_PROXY`) for their reverse proxy, a real backup policy, and the GitHub Environment `prod-server` with 2 required reviewers.
Optional extras for a stricter pipeline: image signing and an SBOM attached to each build, build provenance, and environment-scoped secrets.

## Checklist for the next session (what Claude does vs what you do)

Claude: finish and prove the migration runner; Dockerfile `COPY` lines; Trivy step; `promote-uat.yml` if 3B; smoke-test additions; the docs above; commit
by explicit path (never `git add *.md`: `PROGRESS-REPORT-DRAFT.md` stays untracked).
You: GitHub branch-protection checks (item 2), the `uat` Environment and secrets (item 4), Railway pre-deploy command and source branch (items 1, 3), the
Sonar decision, and the nightly-backup storage choice.

Read `DEPLOY-UAT.md` first, then this file. Start with item 1.
