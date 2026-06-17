# Branch Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the AIMRS CI/CD pipeline from a 2-branch model to a 5-branch GitFlow model (feature/* → develop → test → uat → main) with progressive CI gates and placeholder deploy workflows.

**Architecture:** Two existing workflow files get trigger updates. One new deploy.yml is created with placeholder deploy steps for 3 environments. CLAUDE.md is updated to document the new branch model. Branches are created from develop and pushed to GitHub. GitHub Environments and branch protection rules are configured manually in the UI.

**Tech Stack:** GitHub Actions, GitHub Environments (manual approval gates), Git

---

## Files to Create / Modify

| File | Action | What changes |
|---|---|---|
| `.github/workflows/ci.yml` | Modify line 7 | Add `test`, `uat` to `pull_request: branches:` |
| `.github/workflows/security.yml` | Modify lines 5 + 7 | Add `test`, `uat` to `push:` and `pull_request: branches:` |
| `.github/workflows/deploy.yml` | Create | New placeholder deploy workflow for test/uat/main |
| `CLAUDE.md` | Modify §13 | Update Git Strategy to document all 5 branches + protection rules |

---

## Task 1: Update `ci.yml` Triggers

**Files:**
- Modify: `.github/workflows/ci.yml` line 7

- [ ] **Step 1: Edit the `pull_request` trigger in `ci.yml`**

Find this block at the top of `.github/workflows/ci.yml`:

```yaml
on:
  push:
    branches: ['**']
  pull_request:
    branches: [develop, main]
```

Replace it with:

```yaml
on:
  push:
    branches: ['**']
  pull_request:
    branches: [develop, test, uat, main]
```

- [ ] **Step 2: Verify the change**

```bash
grep -A 4 "pull_request:" .github/workflows/ci.yml
```

Expected output:
```
  pull_request:
    branches: [develop, test, uat, main]
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test and uat branches to ci.yml PR triggers"
```

---

## Task 2: Update `security.yml` Triggers

**Files:**
- Modify: `.github/workflows/security.yml` lines 5 + 7

- [ ] **Step 1: Edit both trigger blocks in `security.yml`**

Find this block at the top of `.github/workflows/security.yml`:

```yaml
on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]
  schedule:
    - cron: '0 0 * * *'   # daily at midnight UTC
```

Replace it with:

```yaml
on:
  push:
    branches: [develop, test, uat, main]
  pull_request:
    branches: [develop, test, uat, main]
  schedule:
    - cron: '0 0 * * *'   # daily at midnight UTC
```

- [ ] **Step 2: Verify the change**

```bash
grep -A 2 "push:" .github/workflows/security.yml
```

Expected output:
```
  push:
    branches: [develop, test, uat, main]
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/security.yml
git commit -m "ci: add test and uat branches to security.yml triggers"
```

---

## Task 3: Create `deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [test, uat, main]

permissions:
  contents: read

jobs:
  # ── Deploy to Test ────────────────────────────────────────────────────────
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
      #     echo "$SSH_KEY" > /tmp/deploy_key && chmod 600 /tmp/deploy_key
      #     ssh -i /tmp/deploy_key -o StrictHostKeyChecking=no \
      #       ${{ secrets.TEST_SERVER_USER }}@${{ secrets.TEST_SERVER_HOST }} \
      #       "cd /app && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
      #   env:
      #     SSH_KEY: ${{ secrets.TEST_SERVER_KEY }}

      - name: Deployment placeholder
        run: |
          echo "=================================================="
          echo "  Test server deploy not yet configured."
          echo "  Add credentials to the test-server GitHub Environment"
          echo "  when CICC provides server access."
          echo "=================================================="

  # ── Deploy to UAT ─────────────────────────────────────────────────────────
  # Manual approval required — a reviewer must approve in GitHub
  # before this job runs (configured in uat-server Environment settings).
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
      #     echo "$SSH_KEY" > /tmp/deploy_key && chmod 600 /tmp/deploy_key
      #     ssh -i /tmp/deploy_key -o StrictHostKeyChecking=no \
      #       ${{ secrets.UAT_SERVER_USER }}@${{ secrets.UAT_SERVER_HOST }} \
      #       "cd /app && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
      #   env:
      #     SSH_KEY: ${{ secrets.UAT_SERVER_KEY }}

      - name: Deployment placeholder
        run: |
          echo "=================================================="
          echo "  UAT server deploy not yet configured."
          echo "  Add credentials to the uat-server GitHub Environment"
          echo "  when CICC provides server access."
          echo "=================================================="

  # ── Deploy to Production ──────────────────────────────────────────────────
  # Manual approval required — all reviewers must approve in GitHub
  # before this job runs (configured in prod-server Environment settings).
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
      #     echo "$SSH_KEY" > /tmp/deploy_key && chmod 600 /tmp/deploy_key
      #     ssh -i /tmp/deploy_key -o StrictHostKeyChecking=no \
      #       ${{ secrets.PROD_SERVER_USER }}@${{ secrets.PROD_SERVER_HOST }} \
      #       "cd /app && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
      #   env:
      #     SSH_KEY: ${{ secrets.PROD_SERVER_KEY }}

      - name: Deployment placeholder
        run: |
          echo "=================================================="
          echo "  Production server deploy not yet configured."
          echo "  Add credentials to the prod-server GitHub Environment"
          echo "  when CICC provides server access."
          echo "=================================================="
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add deploy.yml with placeholder jobs for test, uat, and prod environments"
```

---

## Task 4: Update CLAUDE.md §13 Git Strategy

**Files:**
- Modify: `CLAUDE.md` (§13 Development Workflow → Git Strategy)

- [ ] **Step 1: Update the Git Strategy section**

Find this exact block in `CLAUDE.md` §13 (around line 532):

    ### Git Strategy
    - `main` — production-ready code only
    - `develop` — integration branch
    - `feature/<ticket-id>-<short-description>` — individual feature branches
    - Pull requests require peer review before merge
    - All PRs must pass automated Jest tests

Replace it with the following (copy exactly — the table and bullet list are standard markdown, no code fences needed):

    ### Git Strategy

    #### Branch Model (GitFlow — 5 branches)

    All promotions between long-lived branches require a PR. No direct pushes to `develop`, `test`, `uat`, or `main`.

    Promotion flow: `feature/*` → `develop` → `test` → `uat` → `main`

    | Branch | Purpose | CI gates | Reviews required |
    |---|---|---|---|
    | `main` | Production — CICC handover build | All CI + all security checks | 2 |
    | `uat` | User Acceptance Testing — CICC stakeholders | All CI + all security checks | 1 |
    | `test` | Internal testing phase — Jest, JMeter, security | All CI + secret-scan + CodeQL | 1 |
    | `develop` | Integration — all feature work lands here | All CI checks | 1 |
    | `feature/<ticket-id>-<desc>` | Individual feature work | CI runs, no gate to push | 0 |

    #### Branch Protection Summary
    - `feature/*` — no protection (developer pushes freely)
    - `develop` — requires PR + 1 review + `backend-ci`, `frontend-ci`, `backend-e2e`, `shared-pkg` green
    - `test` — requires PR + 1 review + all `develop` checks + `secret-scan`, `codeql` green
    - `uat` — requires PR + 1 review + all `test` checks + `dependency-audit`, `owasp-dc` green
    - `main` — requires PR + 2 reviews + all checks green + force pushes blocked

    #### Deploy Environments (activated when CICC provides server access)
    - `test` branch → `test-server` GitHub Environment (auto-deploy)
    - `uat` branch → `uat-server` GitHub Environment (manual approval gate)
    - `main` branch → `prod-server` GitHub Environment (manual approval gate)

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md §13 to document 5-branch GitFlow strategy"
```

---

## Task 5: Create and Push `test` and `uat` Branches

- [ ] **Step 1: Ensure you are on an up-to-date `develop` branch**

```bash
git checkout develop
git pull origin develop
```

Expected: Branch is up to date with `origin/develop`.

- [ ] **Step 2: Create and push the `test` branch**

```bash
git checkout -b test
git push origin test
```

Expected output ends with:
```
 * [new branch]      test -> test
```

- [ ] **Step 3: Create and push the `uat` branch**

```bash
git checkout develop
git checkout -b uat
git push origin uat
```

Expected output ends with:
```
 * [new branch]      uat -> uat
```

- [ ] **Step 4: Return to develop**

```bash
git checkout develop
```

- [ ] **Step 5: Verify all 5 branches exist on GitHub**

Go to `https://github.com/jherome29/ITAM-System/branches`

You should see: `main`, `uat`, `test`, `develop`, and any active `feature/*` branches.

---

## Task 6: Set Up GitHub Environments (Manual — Browser)

GitHub Environments power the manual approval gates on `uat` and `main` deploys.

Navigate to `https://github.com/jherome29/ITAM-System/settings/environments`

- [ ] **Step 1: Create `test-server` environment**

1. Click **"New environment"**
2. Name: `test-server` → click **"Configure environment"**
3. **Deployment branches:** select **"Selected branches"** → add `test`
4. **No required reviewers** (test deploys automatically)
5. Click **"Save protection rules"**

- [ ] **Step 2: Create `uat-server` environment**

1. Click **"New environment"**
2. Name: `uat-server` → click **"Configure environment"**
3. **Deployment branches:** select **"Selected branches"** → add `uat`
4. **Required reviewers:** click **"Add required reviewers"** → add 1–2 team members
5. Click **"Save protection rules"**

- [ ] **Step 3: Create `prod-server` environment**

1. Click **"New environment"**
2. Name: `prod-server` → click **"Configure environment"**
3. **Deployment branches:** select **"Selected branches"** → add `main`
4. **Required reviewers:** click **"Add required reviewers"** → add all team members
5. Click **"Save protection rules"**

---

## Task 7: Configure Branch Protection Rules (Manual — Browser)

Navigate to `https://github.com/jherome29/ITAM-System/settings/branches`

**Important:** Status check names (`backend-ci`, `codeql`, etc.) only appear in the search box after GitHub has seen at least one workflow run on that branch. Complete Task 5 (push branches) and push at least one commit to `test` before adding security check names to its protection rule.

- [ ] **Step 1: Update `develop` protection rule**

If a rule already exists for `develop` from the previous CI setup, edit it. Otherwise create new.

Settings:
- Branch name pattern: `develop`
- Require a pull request before merging: **Yes**
- Required approvals: **1**
- Require status checks to pass: **Yes**
  - Add: `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`
- Require branches to be up to date before merging: **Yes**
- Do not allow force pushes: **Yes**
- Click **"Save changes"**

- [ ] **Step 2: Create `test` protection rule**

1. Click **"Add branch protection rule"**
2. Branch name pattern: `test`
3. Require a pull request before merging: **Yes**
4. Required approvals: **1**
5. Require status checks to pass: **Yes**
   - Add: `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`, `secret-scan`, `codeql`
   - *(If `secret-scan` / `codeql` don't appear yet: push a commit to `test` first, wait for the security.yml run to complete, then come back and add them)*
6. Require branches to be up to date: **Yes**
7. Do not allow force pushes: **Yes**
8. Click **"Create"**

- [ ] **Step 3: Create `uat` protection rule**

1. Click **"Add branch protection rule"**
2. Branch name pattern: `uat`
3. Require a pull request before merging: **Yes**
4. Required approvals: **1**
5. Require status checks to pass: **Yes**
   - Add: `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`, `secret-scan`, `codeql`, `dependency-audit`
   - Skip `owasp-dc` for now — it has `continue-on-error: true` so GitHub won't treat it as blocking. Add it only after removing that flag from `security.yml`.
6. Require branches to be up to date: **Yes**
7. Do not allow force pushes: **Yes**
8. Click **"Create"**

- [ ] **Step 4: Update `main` protection rule**

Edit the existing `main` rule (from previous CI setup):

1. Required approvals: **2**
2. Require status checks: same as `uat` — `shared-pkg`, `backend-ci`, `frontend-ci`, `backend-e2e`, `secret-scan`, `codeql`, `dependency-audit`
3. Do not allow bypassing the above settings: **Yes**
4. Click **"Save changes"**

---

## Task 8: Validate the Full Pipeline

- [ ] **Step 1: Push all workflow changes to `develop`**

If you've been working on a feature branch, open a PR to `develop`. Otherwise if already on `develop`:

```bash
git push origin develop
```

Go to `https://github.com/jherome29/ITAM-System/actions` — you should see a **CI** run and a **Security** run triggered by the `develop` push.

- [ ] **Step 2: Verify deploy.yml triggers on `test`**

Push a trivial commit to `test` to trigger `deploy.yml`:

```bash
git checkout test
git merge develop --no-edit
git push origin test
```

Go to GitHub Actions — you should see a **Deploy** workflow run. The `deploy-test` job should run and print the placeholder message:
```
Test server deploy not yet configured...
```

The `deploy-uat` and `deploy-prod` jobs should be **skipped** (their `if:` conditions don't match).

- [ ] **Step 3: Verify security.yml now runs on `test` push**

In the same Actions run list, you should also see a **Security** workflow triggered by the `test` push — this confirms the security.yml trigger update worked.

- [ ] **Step 4: Open a PR from `develop` to `test` to verify branch protection**

```bash
git checkout develop
```

Go to `https://github.com/jherome29/ITAM-System/compare/test...develop` → click **"Create pull request"**.

On the PR page, you should see the required status checks listed. They must all pass before the merge button activates.

- [ ] **Step 5: Verify GitHub Environments appear in deploy runs**

Go to `https://github.com/jherome29/ITAM-System/deployments` — you should see the three environments listed: `test-server`, `uat-server`, `prod-server`.

---

## Summary: What the Pipeline Looks Like After This Plan

```
Push to feature/* ──► ci.yml only (fast feedback)

PR to develop ───────► ci.yml gate (shared-pkg, backend-ci, frontend-ci, backend-e2e)
Push to develop ─────► ci.yml + security.yml

PR to test ──────────► ci.yml + security.yml gate
Push to test ────────► ci.yml + security.yml + deploy.yml (test-server, auto)

PR to uat ───────────► ci.yml + security.yml gate (all checks)
Push to uat ─────────► ci.yml + security.yml + deploy.yml (uat-server, manual approval)

PR to main ──────────► ci.yml + security.yml gate (all checks, 2 reviews)
Push to main ────────► ci.yml + security.yml + deploy.yml (prod-server, manual approval)
```

When CICC provides server access: uncomment the SSH deploy steps in `deploy.yml` and add server credentials to the GitHub Environments. No structural changes needed.
