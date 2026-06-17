# Branch Strategy Design — AIMRS (CICC)

**Date:** 2026-06-17
**Project:** Asset Inventory Management and Requisition System (AIMRS)
**Repo:** https://github.com/jherome29/ITAM-System (public)
**Related spec:** `docs/superpowers/specs/2026-06-15-cicd-pipeline-design.md`

---

## Context

The existing CI/CD pipeline (`ci.yml` + `security.yml`) was built against a two-branch model (`develop`, `main`). This spec extends the branch strategy to a five-branch GitFlow model that represents distinct environments and maps to the capstone project phases. CICC will provide server access at a future date — the deploy workflow is designed now as placeholders that get activated when that happens.

---

## Branch Structure

### Long-lived branches (never deleted)

| Branch | Purpose | Maps to environment |
|---|---|---|
| `main` | Production-ready code. Final CICC handover build. | Production server (CICC-managed) |
| `uat` | User Acceptance Testing. CICC stakeholders evaluate here. | UAT server |
| `test` | Internal testing phase. Jest, JMeter stress tests, security validation. | Test server |
| `develop` | Integration branch. All feature work lands here first. | Local / dev |

### Short-lived branches (deleted after merge)

| Pattern | Purpose |
|---|---|
| `feature/<ticket-id>-<desc>` | Individual feature work (existing pattern) |

### Promotion flow

Every promotion between long-lived branches requires a **pull request** — no direct pushes allowed. This creates an auditable trail of who approved each promotion, satisfying COA audit requirements.

```
feature/<ticket-id>-<desc>
         │
         ▼  PR (0 required reviews, ci.yml must pass)
      develop
         │
         ▼  PR (1 required review, all ci.yml checks must pass)
        test
         │
         ▼  PR (1 required review + test sign-off, ci.yml + secret-scan + codeql must pass)
        uat
         │
         ▼  PR (2 required reviews, all ci.yml + all security.yml checks must pass)
        main
```

---

## CI/CD Behavior Per Branch

### `feature/*`

- **`ci.yml`:** Runs on every push (fast feedback to developer)
- **`security.yml`:** Does not run (saves runner minutes; security scans happen at develop+)
- **Deploy:** None

### `develop`

- **`ci.yml`:** Runs on push and on PRs targeting `develop`
- **`security.yml`:** Runs on push to `develop` (daily schedule also applies)
- **Deploy:** None

### `test`

- **`ci.yml`:** Runs on push and on PRs targeting `test`
- **`security.yml`:** Runs on push to `test` and on PRs targeting `test` (daily schedule also applies)
- **Deploy:** `deploy.yml` triggers on push to `test` → deploys to `test-server` GitHub Environment (placeholder until CICC provides server)

### `uat`

- **`ci.yml`:** Runs on push and on PRs targeting `uat`
- **`security.yml`:** Runs on push to `uat` and on PRs targeting `uat`
- **Deploy:** `deploy.yml` triggers on push to `uat` → deploys to `uat-server` GitHub Environment with **manual approval gate** (a team member must click "Approve" in GitHub before the deploy runs)

### `main`

- **`ci.yml`:** Runs on push and on PRs targeting `main`
- **`security.yml`:** Runs on push to `main` and on PRs targeting `main`
- **Deploy:** `deploy.yml` triggers on push to `main` → deploys to `prod-server` GitHub Environment with **manual approval gate**

---

## Workflow File Changes

### 1. Modify `.github/workflows/ci.yml`

Change the `pull_request` trigger to include `test` and `uat`:

```yaml
# Before
on:
  push:
    branches: ['**']
  pull_request:
    branches: [develop, main]

# After
on:
  push:
    branches: ['**']
  pull_request:
    branches: [develop, test, uat, main]
```

### 2. Modify `.github/workflows/security.yml`

Change both `push` and `pull_request` triggers:

```yaml
# Before
on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]
  schedule:
    - cron: '0 0 * * *'

# After
on:
  push:
    branches: [develop, test, uat, main]
  pull_request:
    branches: [develop, test, uat, main]
  schedule:
    - cron: '0 0 * * *'
```

### 3. Create `.github/workflows/deploy.yml` (new)

A single deploy workflow covering all three environments. All actual deploy steps are placeholder comments until CICC provides server credentials.

```yaml
name: Deploy

on:
  push:
    branches: [test, uat, main]

jobs:
  deploy-test:
    name: Deploy to Test
    if: github.ref == 'refs/heads/test'
    runs-on: ubuntu-latest
    environment:
      name: test-server
      url: ${{ vars.TEST_SERVER_URL }}
    steps:
      - uses: actions/checkout@v4

      # --- PLACEHOLDER: uncomment when CICC provides test server access ---
      # - name: Build Docker images
      #   run: docker compose -f docker-compose.prod.yml build
      #
      # - name: Deploy to test server
      #   run: |
      #     # Add deploy steps: SSH, docker pull, docker compose up
      #   env:
      #     TEST_SERVER_HOST: ${{ secrets.TEST_SERVER_HOST }}
      #     TEST_SERVER_USER: ${{ secrets.TEST_SERVER_USER }}
      #     TEST_SERVER_KEY: ${{ secrets.TEST_SERVER_KEY }}

      - name: Deployment placeholder
        run: echo "Test server deploy not yet configured. Add server credentials to test-server GitHub Environment."

  deploy-uat:
    name: Deploy to UAT
    if: github.ref == 'refs/heads/uat'
    runs-on: ubuntu-latest
    environment:
      name: uat-server
      url: ${{ vars.UAT_SERVER_URL }}
    steps:
      - uses: actions/checkout@v4

      # --- PLACEHOLDER: uncomment when CICC provides UAT server access ---
      # - name: Build Docker images
      #   run: docker compose -f docker-compose.prod.yml build
      #
      # - name: Deploy to UAT server
      #   run: |
      #     # Add deploy steps: SSH, docker pull, docker compose up
      #   env:
      #     UAT_SERVER_HOST: ${{ secrets.UAT_SERVER_HOST }}
      #     UAT_SERVER_USER: ${{ secrets.UAT_SERVER_USER }}
      #     UAT_SERVER_KEY: ${{ secrets.UAT_SERVER_KEY }}

      - name: Deployment placeholder
        run: echo "UAT server deploy not yet configured. Add server credentials to uat-server GitHub Environment."

  deploy-prod:
    name: Deploy to Production
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: prod-server
      url: ${{ vars.PROD_SERVER_URL }}
    steps:
      - uses: actions/checkout@v4

      # --- PLACEHOLDER: uncomment when CICC provides production server access ---
      # - name: Build Docker images
      #   run: docker compose -f docker-compose.prod.yml build
      #
      # - name: Deploy to production server
      #   run: |
      #     # Add deploy steps: SSH, docker pull, docker compose up
      #   env:
      #     PROD_SERVER_HOST: ${{ secrets.PROD_SERVER_HOST }}
      #     PROD_SERVER_USER: ${{ secrets.PROD_SERVER_USER }}
      #     PROD_SERVER_KEY: ${{ secrets.PROD_SERVER_KEY }}

      - name: Deployment placeholder
        run: echo "Production server deploy not yet configured. Add server credentials to prod-server GitHub Environment."
```

---

## GitHub Environments Setup (Manual, in GitHub UI)

GitHub Environments hold environment-specific secrets and enable manual approval gates.

Navigate to **GitHub repo → Settings → Environments** and create three environments:

### `test-server`
- No required reviewers (deploys automatically on push to `test`)
- Add when CICC provides access: `TEST_SERVER_HOST`, `TEST_SERVER_USER`, `TEST_SERVER_KEY`
- Add variable: `TEST_SERVER_URL` (the test server URL, for display in GitHub)

### `uat-server`
- **Required reviewers:** add 1–2 team members (must click "Approve" before deploy runs)
- Add when CICC provides access: `UAT_SERVER_HOST`, `UAT_SERVER_USER`, `UAT_SERVER_KEY`
- Add variable: `UAT_SERVER_URL`

### `prod-server`
- **Required reviewers:** add all team members or adviser
- Add when CICC provides access: `PROD_SERVER_HOST`, `PROD_SERVER_USER`, `PROD_SERVER_KEY`
- Add variable: `PROD_SERVER_URL`

---

## Branch Protection Rules

Set in **GitHub repo → Settings → Branches → Add branch protection rule** for each long-lived branch.

### `develop`
- Require PR before merging: Yes
- Required approvals: 1
- Required status checks: `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`
- Require branches to be up to date: Yes
- Block force pushes: Yes

### `test`
- Require PR before merging: Yes
- Required approvals: 1
- Required status checks: `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`, `secret-scan`, `codeql`
- Require branches to be up to date: Yes
- Block force pushes: Yes

### `uat`
- Require PR before merging: Yes
- Required approvals: 1
- Required status checks: `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`, `secret-scan`, `codeql`, `dependency-audit`, `owasp-dc`
- Require branches to be up to date: Yes
- Block force pushes: Yes
- **Note:** `owasp-dc` currently has `continue-on-error: true` in `security.yml`. Remove that flag before adding `owasp-dc` as a required check — otherwise GitHub treats it as always-passing and it won't block merges.

### `main`
- Require PR before merging: Yes
- Required approvals: 2
- Required status checks: `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`, `secret-scan`, `codeql`, `dependency-audit`, `owasp-dc`
- **Note:** Same `owasp-dc` note as above — remove `continue-on-error: true` first.
- Require branches to be up to date: Yes
- Block force pushes: Yes
- Do not allow bypassing the above settings: Yes

---

## Initializing the New Branches

Create `test`, `uat` branches from `develop` once the current `develop` branch is stable:

```bash
git checkout develop
git pull origin develop

git checkout -b test
git push origin test

git checkout -b uat
git push origin uat
```

`main` already exists. The branch protection rules are applied after branches exist and at least one CI run has completed (so job names appear in GitHub's status check search box).

---

## How This Integrates with the Existing CLAUDE.md Git Strategy

The existing CLAUDE.md §13 documents:
- `main` — production-ready code only
- `develop` — integration branch
- `feature/<ticket-id>-<short-description>` — feature branches

This spec extends that to:
- `main` — production-ready code only (unchanged)
- `uat` — new: UAT environment
- `test` — new: testing environment
- `develop` — integration branch (unchanged)
- `feature/<ticket-id>-<short-description>` — feature branches (unchanged)

**CLAUDE.md §13 should be updated** to reflect the new branch list and protection rules.

---

## What Changes When CICC Provides Server Access

1. For each environment (`test`, `uat`, `prod`):
   - Add the server SSH credentials to the corresponding GitHub Environment secrets
   - Uncomment the deploy steps in `.github/workflows/deploy.yml`
   - Add `docker-compose.prod.yml` deployment commands specific to the server setup
2. Remove the placeholder `echo` steps
3. Set `TEST_SERVER_URL`, `UAT_SERVER_URL`, `PROD_SERVER_URL` variables in each environment

No structural changes to the workflow — only uncommenting and filling in credentials.

---

*Design approved 2026-06-17. Implement via writing-plans skill.*
