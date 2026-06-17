# CI/CD Pipeline Design — AIMRS (CICC)

**Date:** 2026-06-15
**Project:** Asset Inventory Management and Requisition System (AIMRS)
**Repo:** https://github.com/jherome29/ITAM-System (public)
**Stack:** NestJS (Backend) + Next.js (Frontend) + TypeScript monorepo (npm workspaces)

---

## Context

No CI/CD exists today. All quality checks in `CHECKS.md` are run manually by developers. The goal is to automate every check in `CHECKS.md` plus add deeper security scanning (CodeQL, SonarCloud, OWASP Dependency-Check) appropriate for a government-grade system targeting OWASP ASVS compliance.

SonarCloud account does not yet exist — setup steps are documented below.
CD (Docker image push) is deferred; the pipeline is designed to be extended with it later.

---

## Approach: Multi-Workflow by Concern (Approach B)

Three separate workflow files + one supporting config, each with a single clear responsibility.

### Why this structure

- `ci.yml` is the fast PR gate (~5 min). Developers get feedback quickly.
- `security.yml` runs deeper scans that would slow PRs if included in `ci.yml`. Runs in parallel, advisory on PRs, promoted to required before production handover.
- Separating concerns makes each file readable in isolation and easy to extend.

---

## Files to Create

```
.github/
  workflows/
    ci.yml
    security.yml
  dependabot.yml
sonar-project.properties
```

---

## Workflow 1: `ci.yml` — Fast PR Gate

### Triggers

```yaml
on:
  push:
    branches: ["**"]
  pull_request:
    branches: [develop, main]
```

Runs on every push (gives developers instant feedback on feature branches) and on every PR targeting `develop` or `main`.

### Jobs

All jobs use `runs-on: ubuntu-latest` and `node-version: '20'` with npm cache.

Job dependency graph:
```
shared-pkg
  ├── backend-ci → sonarcloud
  ├── frontend-ci
  └── backend-e2e
```

#### `shared-pkg`

Validates the shared TypeScript package first. Both backend and frontend depend on it.

1. Checkout
2. Setup Node.js 20 + npm cache
3. `npm ci --workspace=packages/shared`
4. `cd packages/shared && npx tsc --noEmit`

#### `backend-ci` (needs: `shared-pkg`)

Implements CHECKS.md steps 1–6.

1. Checkout + Node.js 20
2. `npm ci --workspace=Backend`
3. **TypeScript** — `cd Backend && npx tsc --noEmit` (step 1)
4. **ESLint** — `cd Backend && npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0` (step 2)
5. **Build** — `cd Backend && npm run build` (step 3) — validates pdfkit/bcrypt webpack externals
6. **Unit tests** — `cd Backend && npm run test` (step 4)
7. **Coverage** — `cd Backend && npm run test:cov` (step 5) — enforces thresholds: 65% statements/lines, 55% branches/functions
8. Upload `coverage/lcov.info` as artifact `backend-coverage` (consumed by `sonarcloud` job in the same `ci.yml` run)

#### `sonarcloud` (needs: `backend-ci`)

Requires `SONAR_TOKEN` in GitHub repository secrets (see setup steps below).

1. Checkout
2. Download `backend-coverage` artifact from `backend-ci` (same `ci.yml` run)
3. `uses: SonarSource/sonarcloud-github-action@master`
   - `env.SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}`
   - Reads `sonar-project.properties` at repo root

SonarCloud reports: code coverage trends, code smells, security hotspots, duplication, maintainability debt. Free for unlimited public repos.

#### `frontend-ci` (needs: `shared-pkg`)

Implements CHECKS.md steps 7–9.

1. Checkout + Node.js 20
2. `npm ci --workspace=Frontend`
3. **TypeScript** — `cd Frontend && npx tsc --noEmit` (step 7)
4. **ESLint** — `cd Frontend && npx eslint . --max-warnings 0` (step 8)
5. **Build** — `cd Frontend && npm run build` (step 9)

#### `backend-e2e` (needs: `shared-pkg`)

Runs integration tests against a real PostgreSQL database.

Services:
```yaml
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
```

Steps:
1. Checkout + Node.js 20
2. `npm ci --workspace=Backend`
3. Set env: `DATABASE_URL=postgresql://aimrs_test:aimrs_test@localhost:5432/aimrs_test`
4. Run any pending migrations (if migration runner script exists)
5. `cd Backend && npm run test:e2e`

### Required Status Checks (branch protection)

Set these as required in GitHub → Settings → Branches for `develop` and `main`:
- `backend-ci`
- `frontend-ci`
- `backend-e2e`
- `shared-pkg`

---

## Workflow 2: `security.yml` — Deep Security Scans

### Triggers

```yaml
on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]
  schedule:
    - cron: '0 0 * * *'   # daily at midnight UTC
```

Advisory on PRs (not blocking). Can be promoted to required status checks before the CICC handover in October 2026.

### Jobs

Four jobs, all run in parallel. SonarCloud is in `ci.yml` (needs coverage artifact from same run).

#### `secret-scan`

Runs `secretlint` (already installed at root).

1. Checkout
2. `npm ci` (root)
3. `npx secretlint "**/*"` (CHECKS.md step 10)

Note: Enable GitHub's built-in **Secret Scanning** in repo Settings → Security → Secret scanning. This is zero-config for public repos and provides real-time alerts for committed secrets — complementary to secretlint.

#### `codeql`

GitHub's semantic code analysis. Free for public repos, no additional tooling needed.

```yaml
- uses: github/codeql-action/init@v3
  with:
    languages: javascript-typescript
    queries: security-and-quality
- uses: github/codeql-action/autobuild@v3
- uses: github/codeql-action/analyze@v3
  with:
    category: "/language:javascript-typescript"
```

Results appear in GitHub Security → Code Scanning. SARIF annotations appear inline on PR diffs. `security-and-quality` query suite catches: SQL injection, XSS, path traversal, auth bypass patterns, insecure deserialization, and code quality issues.

#### `sonarcloud` — **moved to `ci.yml`** (needs: `backend-ci`)

SonarCloud is placed in `ci.yml` (not `security.yml`) so it can access the coverage artifact from `backend-ci` in the same workflow run. GitHub Actions artifacts are scoped to a single workflow run — cross-workflow artifact sharing is not possible without external storage.

Requires `SONAR_TOKEN` in GitHub repository secrets (see setup steps below).

1. Checkout
2. Download `backend-coverage` artifact (from `backend-ci` in the same `ci.yml` run)
3. `uses: SonarSource/sonarcloud-github-action@master`
   - `env.SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}`
   - Reads `sonar-project.properties` at repo root

SonarCloud reports: code coverage trends, code smells, security hotspots, duplication, maintainability debt. Free for unlimited public repos.

#### `dependency-audit`

Implements CHECKS.md steps 6 + 11 in CI.

1. Checkout + Node.js 20 + `npm ci`
2. `cd Backend && npm audit --audit-level=high --json > /tmp/backend-audit.json`
3. `cd Frontend && npm audit --audit-level=high --json > /tmp/frontend-audit.json`
4. Upload both JSON files as `dependency-audit-report` artifact
5. Exit non-zero on any high/critical finding (fail the job)

#### `owasp-dc`

OWASP Dependency-Check — cross-references NVD database for CVEs across all dependency types. Generates SARIF + HTML report. Slower (~10 min first run, then cached via `~/.m2` cache). Provides OWASP ASVS compliance evidence.

```yaml
- uses: dependency-check/Dependency-Check_Action@main
  with:
    project: 'AIMRS'
    path: '.'
    format: 'ALL'
    args: >
      --enableRetired
      --nvdApiKey ${{ secrets.NVD_API_KEY }}
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: reports/dependency-check-report.sarif
```

`NVD_API_KEY` is optional — speeds up the NVD database fetch significantly. Get a free key at https://nvd.nist.gov/developers/request-an-api-key.

#### CD Placeholder (comment block)

```yaml
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

---

## Supporting Config: `.github/dependabot.yml`

Dependabot opens PRs automatically when dependency updates are available. Each PR runs `ci.yml`.

```yaml
version: 2
updates:
  # Root workspace
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      root-minor-patch:
        patterns: ["*"]
        update-types: ["minor", "patch"]

  # Backend
  - package-ecosystem: "npm"
    directory: "/Backend"
    schedule:
      interval: "weekly"
    groups:
      backend-patch:
        patterns: ["*"]
        update-types: ["patch"]

  # Frontend
  - package-ecosystem: "npm"
    directory: "/Frontend"
    schedule:
      interval: "weekly"
    groups:
      frontend-patch:
        patterns: ["*"]
        update-types: ["patch"]

  # GitHub Actions versions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## Supporting Config: `sonar-project.properties`

Place at repository root. Fill in `<placeholders>` after SonarCloud project is created.

```properties
sonar.projectKey=<sonarcloud-org>_ITAM-System
sonar.organization=<sonarcloud-org>
sonar.projectName=AIMRS — Asset Inventory Management and Requisition System

sonar.sources=Backend/src,Frontend/app,Frontend/components,Frontend/lib
sonar.tests=Backend/src,Backend/test
sonar.test.inclusions=**/*.spec.ts,**/*.e2e-spec.ts

sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,.next/**,**/migrations/**

# Coverage — lcov.info generated by Jest in backend-ci job
sonar.javascript.lcov.reportPaths=coverage/lcov.info

# TypeScript config
sonar.typescript.tsconfigPath=Backend/tsconfig.json
```

---

## SonarCloud Setup (One-Time, Manual)

1. Go to https://sonarcloud.io → Sign in with GitHub
2. Click "+" → "Analyze new project" → select `jherome29/ITAM-System`
3. Choose "With GitHub Actions" as the analysis method
4. SonarCloud displays your `projectKey` and `organization` — copy into `sonar-project.properties`
5. Copy the `SONAR_TOKEN` value shown
6. In GitHub repo → Settings → Secrets and variables → Actions → New secret: `SONAR_TOKEN`
7. Optional: add `NVD_API_KEY` secret for faster OWASP DC scans

---

## GitHub Secrets Summary

| Secret | Required | Source | Used By |
|---|---|---|---|
| `SONAR_TOKEN` | Yes (for SonarCloud job) | sonarcloud.io project setup | `security.yml` → `sonarcloud` job |
| `NVD_API_KEY` | No (speeds up OWASP DC) | https://nvd.nist.gov/developers/request-an-api-key | `security.yml` → `owasp-dc` job |

---

## Branch Protection Rules (Manual Setup in GitHub)

Navigate to GitHub repo → Settings → Branches → Add rule for each branch.

### `main`
- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass:
  - `shared-pkg`
  - `backend-ci`
  - `frontend-ci`
  - `backend-e2e`
- Require branches to be up to date before merging
- Do not allow force pushes
- Do not allow deletions

### `develop`
Same rules as `main` except approvals requirement is optional (team decision).

---

## Security Feature Checklist (GitHub Settings)

Enable these in GitHub repo Settings → Security:

| Feature | Location | Notes |
|---|---|---|
| Dependency graph | Security → Dependabot | Required for Dependabot PRs |
| Dependabot alerts | Security → Dependabot | Auto-alerts on CVEs in dependencies |
| Dependabot security updates | Security → Dependabot | Auto-PRs for security fixes |
| Secret scanning | Security → Secret scanning | Alerts on pushed secrets |
| Secret scanning push protection | Security → Secret scanning | Blocks pushes containing secrets |
| Code scanning (CodeQL) | Handled by `security.yml` workflow | — |

---

## Coverage Thresholds (Enforced in CI)

From `Backend/package.json` Jest config — enforced by `backend-ci` job:

| Metric | Threshold |
|---|---|
| Statements | 65% |
| Branches | 55% |
| Functions | 55% |
| Lines | 65% |

Target from CLAUDE.md §12: **70% across all metrics**. Raise thresholds in `package.json` as coverage improves.

---

## What's Out of Scope (This Design)

- **CD** — Docker image builds and pushes. CD placeholder comment added to `security.yml`.
- **Trivy** — Container image scanning. Depends on CD being implemented first.
- **Commitlint** — Conventional commit enforcement. Can be added as a job to `ci.yml` later.
- **Performance testing (JMeter)** — Scheduled for Testing & Evaluation phase (Aug 16–Sep 15, 2026). Not part of CI.
- **UAT automation** — Manual process per CLAUDE.md §12.

---

## CHECKS.md Coverage Mapping

Every step in `CHECKS.md` is automated in CI:

| CHECKS.md Step | CI Job | Workflow |
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
| 11a–d. Smoke Tests | Not automated — manual + e2e job covers RBAC | — |

---

*Design approved 2026-06-15. Implement via writing-plans skill.*
