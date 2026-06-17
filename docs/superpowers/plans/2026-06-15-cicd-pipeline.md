# CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate all 11 CHECKS.md quality gates and add SonarCloud, CodeQL, OWASP Dependency-Check, and Dependabot scanning to the AIMRS monorepo via GitHub Actions.

**Architecture:** Two workflow files (`ci.yml` for the fast PR gate, `security.yml` for deep security scans) plus `dependabot.yml` config and `sonar-project.properties`. SonarCloud lives in `ci.yml` so it shares the Jest coverage artifact from the same workflow run. All four security jobs in `security.yml` run in parallel and are advisory (non-blocking) until the team promotes them before CICC handover.

**Tech Stack:** GitHub Actions, SonarCloud, GitHub CodeQL, OWASP Dependency-Check, Dependabot, secretlint (already installed), Jest (already installed), Node.js 20, PostgreSQL 16 (e2e service container)

---

## Files to Create

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Fast PR gate: TypeScript, ESLint, Build, Tests, Coverage, SonarCloud |
| `.github/workflows/security.yml` | Deep security: CodeQL, OWASP DC, dep audit, secret scan |
| `.github/dependabot.yml` | Automated dependency update PRs |
| `sonar-project.properties` | SonarCloud project config (root) |

No existing files are modified.

---

## Task 1: Create `ci.yml` — Fast PR Gate

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflows directory and `ci.yml`**

Create `.github/workflows/ci.yml` with this exact content:

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [develop, main]

permissions:
  contents: read

jobs:
  # ── Shared Package ────────────────────────────────────────────────────────
  shared-pkg:
    name: Shared Package
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check (shared)
        run: cd packages/shared && npx tsc --noEmit

  # ── Backend CI ────────────────────────────────────────────────────────────
  backend-ci:
    name: Backend CI
    needs: shared-pkg
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: cd Backend && npx tsc --noEmit

      - name: ESLint
        run: cd Backend && npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0

      - name: Build
        run: cd Backend && npm run build

      - name: Unit tests
        run: cd Backend && npm run test

      - name: Coverage (threshold enforced)
        run: cd Backend && npm run test:cov

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: coverage/lcov.info
          retention-days: 1

  # ── SonarCloud ────────────────────────────────────────────────────────────
  # Runs after backend-ci to consume the coverage artifact from this same run.
  # continue-on-error: true until SONAR_TOKEN secret is configured (Task 5).
  # Remove continue-on-error after SONAR_TOKEN is added to repo secrets.
  sonarcloud:
    name: SonarCloud
    needs: backend-ci
    runs-on: ubuntu-latest
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # SonarCloud needs full history for blame info

      - name: Download coverage report
        uses: actions/download-artifact@v4
        with:
          name: backend-coverage
          path: coverage

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # ── Frontend CI ───────────────────────────────────────────────────────────
  frontend-ci:
    name: Frontend CI
    needs: shared-pkg
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: cd Frontend && npx tsc --noEmit

      - name: ESLint
        run: cd Frontend && npx eslint . --max-warnings 0

      - name: Build
        run: cd Frontend && npm run build

  # ── Backend E2E ───────────────────────────────────────────────────────────
  backend-e2e:
    name: Backend E2E
    needs: shared-pkg
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: aimrs_test
          POSTGRES_PASSWORD: aimrs_test
          POSTGRES_DB: aimrs_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # The e2e test boots AppModule which connects to TypeORM.
      # DATABASE_URL points to the ephemeral postgres service above.
      # TypeORM synchronize:true is acceptable here because the CI
      # database is fresh and empty on every run (no columns to drop).
      # Add migration steps here as the e2e test suite grows.
      - name: Run e2e tests
        run: cd Backend && npm run test:e2e
        env:
          DATABASE_URL: postgresql://aimrs_test:aimrs_test@localhost:5432/aimrs_test
          JWT_SECRET: ci-test-jwt-secret-32-chars-minimum
          JWT_EXPIRES_IN: 8h
          NODE_ENV: test
```

- [ ] **Step 2: Verify the YAML is valid**

Run this from the repo root (requires Python, which is pre-installed on most systems):

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```

Expected output: `YAML valid`

If Python isn't available, paste the file into https://www.yamllint.com/ — all lines should be green.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow (lint, test, coverage, e2e, SonarCloud)"
```

---

## Task 2: Create `security.yml` — Deep Security Scans

**Files:**
- Create: `.github/workflows/security.yml`

- [ ] **Step 1: Create `security.yml`**

Create `.github/workflows/security.yml` with this exact content:

```yaml
name: Security

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]
  schedule:
    - cron: '0 0 * * *'   # daily at midnight UTC

permissions:
  contents: read
  security-events: write   # required to upload SARIF to GitHub Security tab
  actions: read

jobs:
  # ── Secret Scan ───────────────────────────────────────────────────────────
  secret-scan:
    name: Secret Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run secretlint
        run: npx secretlint "**/*"

  # ── CodeQL ────────────────────────────────────────────────────────────────
  codeql:
    name: CodeQL
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
          queries: security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Analyze
        uses: github/codeql-action/analyze@v3
        with:
          category: '/language:javascript-typescript'

  # ── Dependency Audit ──────────────────────────────────────────────────────
  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # Generate JSON reports for artifact storage (|| true so the step
      # doesn't exit early before the upload step runs)
      - name: Backend audit (JSON report)
        run: npm audit --audit-level=high --json --workspace=Backend > /tmp/backend-audit.json || true

      - name: Frontend audit (JSON report)
        run: npm audit --audit-level=high --json --workspace=Frontend > /tmp/frontend-audit.json || true

      - name: Upload audit reports
        uses: actions/upload-artifact@v4
        with:
          name: dependency-audit-report
          path: |
            /tmp/backend-audit.json
            /tmp/frontend-audit.json
          retention-days: 30

      # These steps actually fail the job if high/critical CVEs exist
      - name: Fail on Backend high/critical CVEs
        run: npm audit --audit-level=high --workspace=Backend

      - name: Fail on Frontend high/critical CVEs
        run: npm audit --audit-level=high --workspace=Frontend

  # ── OWASP Dependency-Check ────────────────────────────────────────────────
  # continue-on-error: true prevents a slow NVD DB fetch or empty NVD_API_KEY
  # from blocking the security workflow. Remove once the pipeline is stable.
  owasp-dc:
    name: OWASP Dependency-Check
    runs-on: ubuntu-latest
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4

      # First run downloads the NVD database (~10 min). Subsequent runs use cache.
      - name: Run OWASP Dependency-Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'AIMRS'
          path: '.'
          format: 'ALL'
          args: >
            --enableRetired
            --nvdApiKey ${{ secrets.NVD_API_KEY }}

      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: owasp-dc-report
          path: reports/dependency-check-report.html
          retention-days: 30

      - name: Upload SARIF to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: reports/dependency-check-report.sarif

  # --- FUTURE: CD JOBS ---
  # Add after Docker image build is configured:
  #
  # trivy-scan:
  #   Scan built Docker images using aquasecurity/trivy-action
  #   Upload SARIF to GitHub Security tab
  #
  # docker-push:
  #   Build and push images to GitHub Container Registry (ghcr.io)
  #   Trigger: push to main only
  #   Requires: GHCR_TOKEN secret
```

- [ ] **Step 2: Validate the YAML**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/security.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/security.yml
git commit -m "ci: add security workflow (CodeQL, OWASP DC, dep audit, secret scan)"
```

---

## Task 3: Create `dependabot.yml` and `sonar-project.properties`

**Files:**
- Create: `.github/dependabot.yml`
- Create: `sonar-project.properties`

- [ ] **Step 1: Create `.github/dependabot.yml`**

```yaml
version: 2
updates:
  # Root workspace (secretlint, concurrently)
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    groups:
      root-minor-patch:
        patterns: ['*']
        update-types: ['minor', 'patch']

  # Backend (NestJS, TypeORM, bcrypt, pdfkit, etc.)
  - package-ecosystem: 'npm'
    directory: '/Backend'
    schedule:
      interval: 'weekly'
    groups:
      backend-patch:
        patterns: ['*']
        update-types: ['patch']

  # Frontend (Next.js, React, Tailwind, etc.)
  - package-ecosystem: 'npm'
    directory: '/Frontend'
    schedule:
      interval: 'weekly'
    groups:
      frontend-patch:
        patterns: ['*']
        update-types: ['patch']

  # GitHub Actions workflow action versions
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
```

- [ ] **Step 2: Create `sonar-project.properties` at repo root**

Leave the two `<sonarcloud-org>` placeholders — they are filled in during Task 5 after the SonarCloud account is created.

```properties
sonar.projectKey=<sonarcloud-org>_ITAM-System
sonar.organization=<sonarcloud-org>
sonar.projectName=AIMRS - Asset Inventory Management and Requisition System

sonar.sources=Backend/src,Frontend/app,Frontend/components,Frontend/lib
sonar.tests=Backend/src,Backend/test
sonar.test.inclusions=**/*.spec.ts,**/*.e2e-spec.ts

sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,.next/**,**/migrations/**

# Coverage report produced by Jest in the backend-ci job of ci.yml
sonar.javascript.lcov.reportPaths=coverage/lcov.info

# TypeScript project root
sonar.typescript.tsconfigPath=Backend/tsconfig.json
```

- [ ] **Step 3: Commit both files**

```bash
git add .github/dependabot.yml sonar-project.properties
git commit -m "ci: add Dependabot config and SonarCloud project properties"
```

---

## Task 4: Push and Validate CI Runs on GitHub

- [ ] **Step 1: Push the branch to GitHub**

If you're on `main` or `develop`, push directly. If on a feature branch, push the branch:

```bash
git push origin HEAD
```

- [ ] **Step 2: Verify `ci.yml` triggers**

1. Go to `https://github.com/jherome29/ITAM-System/actions`
2. You should see a workflow run called **"CI"** triggered by your push
3. Click into it — you should see 5 jobs: `shared-pkg`, `backend-ci`, `sonarcloud`, `frontend-ci`, `backend-e2e`

- [ ] **Step 3: Verify `security.yml` triggers (if push was to `develop` or `main`)**

1. In the same Actions tab, look for a workflow run called **"Security"**
2. You should see 4 jobs: `secret-scan`, `codeql`, `dependency-audit`, `owasp-dc`

If you pushed to a feature branch, `security.yml` won't run yet — it only triggers on `develop`/`main` pushes and PRs targeting those branches. That's expected.

- [ ] **Step 4: Triage any job failures**

**Common failures and fixes:**

| Job | Common Failure | Fix |
|---|---|---|
| `shared-pkg` | `tsconfig.json` not found in `packages/shared` | Add a `tsconfig.json` to `packages/shared/` (see note below) |
| `backend-ci` — ESLint | ESLint errors already in codebase | Run `cd Backend && npx eslint "{src,apps,libs,test}/**/*.ts" --fix` locally, commit fixes |
| `backend-ci` — Coverage | Thresholds not met | Check which files are below threshold; add tests |
| `frontend-ci` — Build | Missing `NEXT_PUBLIC_API_URL` | Add `NEXT_PUBLIC_API_URL=http://localhost:3001/api` to Frontend build step env in `ci.yml` |
| `backend-e2e` | TypeORM can't connect | Verify `DATABASE_URL` env var matches the postgres service credentials |
| `sonarcloud` | 401 Unauthorized | Expected — SONAR_TOKEN not set yet. `continue-on-error: true` prevents this from blocking. Fix in Task 5. |
| `owasp-dc` | NVD API timeout | First run without NVD_API_KEY is slow. If it times out, add NVD_API_KEY (Task 5). |

**If `packages/shared` has no `tsconfig.json`**, add one:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Save to `packages/shared/tsconfig.json`, commit, and push again.

**If frontend build fails due to missing env var**, edit `.github/workflows/ci.yml`, find the `frontend-ci` → `Build` step, and add an `env` block:

```yaml
      - name: Build
        run: cd Frontend && npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3001/api
```

Commit and push.

- [ ] **Step 5: Confirm all required jobs are green**

Required jobs (`shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`) must all show a green checkmark. `sonarcloud` may show orange (skipped/warning) — that's fine until Task 5.

---

## Task 5: SonarCloud Manual Setup

This task is done in a browser. No code changes until Step 5.

- [ ] **Step 1: Create SonarCloud account**

1. Go to https://sonarcloud.io
2. Click **"Log in"** → **"Log in with GitHub"**
3. Authorize SonarCloud to access your GitHub account

- [ ] **Step 2: Create organization and import repo**

1. Click **"+"** (top right) → **"Analyze new project"**
2. Select `jherome29/ITAM-System` from the list
3. Click **"Set Up"**
4. When asked "How do you want to analyze your repository?" → choose **"With GitHub Actions"**
5. SonarCloud will display:
   - Your **Organization key** (e.g., `jherome29`)
   - Your **Project key** (e.g., `jherome29_ITAM-System`)
   - A `SONAR_TOKEN` value

- [ ] **Step 3: Copy the SONAR_TOKEN to GitHub Secrets**

1. Copy the `SONAR_TOKEN` value shown by SonarCloud
2. Go to `https://github.com/jherome29/ITAM-System/settings/secrets/actions`
3. Click **"New repository secret"**
4. Name: `SONAR_TOKEN`, Value: paste the token
5. Click **"Add secret"**

- [ ] **Step 4: Update `sonar-project.properties` with real values**

Replace both `<sonarcloud-org>` placeholders with your actual values from Step 2.

For example, if your organization key is `jherome29`:

```properties
sonar.projectKey=jherome29_ITAM-System
sonar.organization=jherome29
sonar.projectName=AIMRS - Asset Inventory Management and Requisition System

sonar.sources=Backend/src,Frontend/app,Frontend/components,Frontend/lib
sonar.tests=Backend/src,Backend/test
sonar.test.inclusions=**/*.spec.ts,**/*.e2e-spec.ts

sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,.next/**,**/migrations/**

sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.typescript.tsconfigPath=Backend/tsconfig.json
```

- [ ] **Step 5: Remove `continue-on-error` from the sonarcloud job**

Edit `.github/workflows/ci.yml`. Find the `sonarcloud:` job and remove the `continue-on-error: true` line:

```yaml
  sonarcloud:
    name: SonarCloud
    needs: backend-ci
    runs-on: ubuntu-latest
    # DELETE the line: continue-on-error: true
    steps:
```

- [ ] **Step 6: Optional — add NVD_API_KEY to speed up OWASP DC**

1. Go to https://nvd.nist.gov/developers/request-an-api-key
2. Fill out the form (free, instant)
3. Add the key to GitHub Secrets as `NVD_API_KEY`

- [ ] **Step 7: Commit and push**

```bash
git add sonar-project.properties .github/workflows/ci.yml
git commit -m "ci: configure SonarCloud with project key and enable SONAR_TOKEN"
git push origin HEAD
```

- [ ] **Step 8: Verify SonarCloud scan runs successfully**

1. Go to GitHub Actions → CI workflow run triggered by your push
2. `sonarcloud` job should now show green
3. Go to https://sonarcloud.io/project/overview?id=jherome29_ITAM-System
4. You should see the first scan result with coverage, code smells, and security hotspots

---

## Task 6: Enable GitHub Repository Security Features

All steps in this task are done in the GitHub web UI. No code changes.

Navigate to `https://github.com/jherome29/ITAM-System/settings/security_analysis`

- [ ] **Step 1: Enable Dependency graph**
   - Under **"Dependency graph"** → click **"Enable"** (if not already on)

- [ ] **Step 2: Enable Dependabot alerts**
   - Under **"Dependabot alerts"** → click **"Enable"**
   - This makes GitHub notify you when any dependency has a known CVE

- [ ] **Step 3: Enable Dependabot security updates**
   - Under **"Dependabot security updates"** → click **"Enable"**
   - Dependabot will now auto-open PRs to fix security CVEs in dependencies

- [ ] **Step 4: Enable Secret scanning**
   - Under **"Secret scanning"** → click **"Enable"**
   - GitHub scans every push and alerts on committed secrets

- [ ] **Step 5: Enable Secret scanning push protection**
   - Under **"Push protection"** → click **"Enable"**
   - GitHub now **blocks pushes** that contain secrets before they reach the repo

After enabling all features, verify by going to **"Security"** tab on the repo page — you should see "Dependabot", "Code scanning", and "Secret scanning" sections.

---

## Task 7: Configure Branch Protection Rules

All steps done in the GitHub web UI. No code changes.

Navigate to `https://github.com/jherome29/ITAM-System/settings/branches`

### Protect `main`

- [ ] **Step 1: Add rule for `main`**

1. Click **"Add branch protection rule"**
2. Branch name pattern: `main`
3. Check **"Require a pull request before merging"**
   - Required approvals: `1`
4. Check **"Require status checks to pass before merging"**
   - Click the search box and add each of these (they appear after at least one CI run):
     - `shared-pkg`
     - `backend-ci`
     - `frontend-ci`
     - `backend-e2e`
5. Check **"Require branches to be up to date before merging"**
6. Check **"Do not allow bypassing the above settings"**
7. Check **"Restrict who can push to matching branches"** → add your team
8. Click **"Create"**

### Protect `develop`

- [ ] **Step 2: Add rule for `develop`**

1. Click **"Add branch protection rule"**
2. Branch name pattern: `develop`
3. Same settings as `main`, except:
   - Required approvals: `0` (optional — team decision)
4. Click **"Create"**

**Note:** The status check names (`shared-pkg`, `backend-ci`, etc.) only appear in the search box after GitHub has seen at least one CI run with those job names. If the dropdown is empty, run the CI workflow first (Task 4), then come back and add the checks.

---

## Task 8: End-to-End Validation

Verify the full pipeline works on a real PR before considering this done.

- [ ] **Step 1: Create a test branch and make a trivial change**

```bash
git checkout -b ci/validate-pipeline
echo "# CI validation" >> .github/PIPELINE_STATUS.md
git add .github/PIPELINE_STATUS.md
git commit -m "ci: validation commit to test full pipeline"
git push origin ci/validate-pipeline
```

- [ ] **Step 2: Open a PR targeting `develop`**

Go to `https://github.com/jherome29/ITAM-System/compare/develop...ci/validate-pipeline` and click **"Create pull request"**.

- [ ] **Step 3: Verify all required status checks appear and pass**

On the PR page, scroll to the bottom. You should see:

```
✅ shared-pkg       — Passing
✅ backend-ci       — Passing
✅ frontend-ci      — Passing
✅ backend-e2e      — Passing
✅ sonarcloud       — Passing (or skipped if SONAR_TOKEN not configured yet)
```

And separately (non-blocking, run by security.yml):
```
✅ secret-scan      — Passing
✅ codeql           — Passing
✅ dependency-audit — Passing
✅ owasp-dc         — Passing
```

- [ ] **Step 4: Merge the PR and verify branch protection works**

Try to merge without the required checks passing — GitHub should block the merge button. Once all checks are green, merge.

- [ ] **Step 5: Verify Dependabot is active**

Go to `https://github.com/jherome29/ITAM-System/network/updates` — you should see Dependabot's update jobs listed for all three npm ecosystems (root, Backend, Frontend) and github-actions.

- [ ] **Step 6: Clean up the test file**

```bash
git checkout develop
git pull
git rm .github/PIPELINE_STATUS.md
git commit -m "ci: remove validation file"
git push origin develop
```

---

## Summary: What You Do vs What CI Does Automatically

| Action | Who |
|---|---|
| Open a PR → required checks run | CI (automatic) |
| Merge blocked until `backend-ci`, `frontend-ci`, `backend-e2e`, `shared-pkg` green | GitHub (automatic) |
| Coverage drops below 65% → CI fails | CI (automatic) |
| ESLint warning introduced → CI fails | CI (automatic) |
| Secret committed → push blocked | GitHub push protection (automatic) |
| New CVE in a dependency → Dependabot opens a PR | Dependabot (automatic, weekly) |
| CodeQL finds an injection pattern → alert in Security tab | CodeQL (automatic, on PR + push) |
| SonarCloud detects security hotspot → comment on PR | SonarCloud (automatic) |
| OWASP DC report generated → downloadable artifact | CI (automatic, daily) |
| Someone pushes directly to `main` without a PR | Blocked by branch protection (automatic) |

---

## CHECKS.md Coverage Map

Every manual step in `CHECKS.md` is now automated:

| CHECKS.md Step | Automated By | Workflow |
|---|---|---|
| 1. Backend TypeScript | `backend-ci` | `ci.yml` |
| 2. Backend ESLint | `backend-ci` | `ci.yml` |
| 3. Backend Build | `backend-ci` | `ci.yml` |
| 4. Backend Unit Tests | `backend-ci` | `ci.yml` |
| 5. Backend Coverage | `backend-ci` | `ci.yml` |
| 6. Backend Dep Audit | `dependency-audit` | `security.yml` |
| 7. Frontend TypeScript | `frontend-ci` | `ci.yml` |
| 8. Frontend ESLint | `frontend-ci` | `ci.yml` |
| 9. Frontend Build | `frontend-ci` | `ci.yml` |
| 10. Secret Scan | `secret-scan` | `security.yml` |
| 11. Frontend Dep Audit | `dependency-audit` | `security.yml` |
| 11a–d. Smoke Tests | `backend-e2e` covers RBAC flows; 11a–d remain manual | — |
