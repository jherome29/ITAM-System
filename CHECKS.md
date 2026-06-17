# AIMRS — Pre-Task Quality Checklist

Run every check in this file **before starting a new feature and after finishing one.**
All checks must pass with zero errors before the task is considered done.

---

## How to use this file

Tell Claude Code:
> "Read CHECKS.md and run every check one by one. Fix any failure before moving to the next check."

Claude Code will execute each command, report the result, and fix failures inline.

---

## Order of Execution

Run in this exact order — later checks depend on earlier ones passing.

---

## 1. Backend — TypeScript

**Directory:** `Backend/`
**Command:**
```bash
cd Backend && npx tsc --noEmit
```
**Pass condition:** No output. Exit code 0.
**What it checks:** Type correctness across all backend source files. No implicit `any`, no missing types, no broken imports.
**If it fails:** Fix every type error reported before proceeding. Do not suppress with `// @ts-ignore` unless there is a documented reason.

---

## 2. Backend — ESLint

**Directory:** `Backend/`
**Command:**
```bash
cd Backend && npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0
```
**Pass condition:** Output is empty. Zero errors, zero warnings.
**What it checks:** Code style (Prettier), security rules (no unsafe regex, no hardcoded secrets), NestJS patterns, TypeScript strictness.
**If it fails:** Run with `--fix` first to auto-fix Prettier issues:
```bash
cd Backend && npx eslint "{src,apps,libs,test}/**/*.ts" --fix
```
Then re-run the check. Any remaining errors must be fixed manually.

---

## 3. Backend — Build

**Directory:** `Backend/`
**Command:**
```bash
cd Backend && npm run build
```
**Pass condition:** Output ends with `webpack compiled successfully`. No errors.
**What it checks:** Full webpack production build. Catches import errors and module resolution issues that TypeScript alone may miss.
**If it fails:** Read the webpack error output carefully. Usually caused by a missing import, a circular dependency, or a module that needs to be added to webpack externals.

---

## 4. Backend — Unit Tests

**Directory:** `Backend/`
**Command:**
```bash
cd Backend && npm run test
```
**Pass condition:** All test suites pass. `0 failed` in the summary line.
**What it checks:** Jest unit tests for all service files. Every test must pass — no exceptions.
**If it fails:** Read the failing test output. Fix the underlying service logic or test, do not skip or comment out tests.

---

## 5. Backend — Test Coverage

**Directory:** `Backend/`
**Command:**
```bash
cd Backend && npm run test:cov
```
**Pass condition:** Coverage thresholds are met (configured in `Backend/package.json`):
- Statements: ≥ 65%
- Branches: ≥ 55%
- Functions: ≥ 55%
- Lines: ≥ 65%

Target to work toward: **70% across all metrics** (CLAUDE.md §12).

**Files measured:**
- `auth/auth.service.ts`
- `auth/guards/roles.guard.ts`
- `assets/assets.service.ts`
- `requisitions/requisitions.service.ts`
- `notifications/notifications.service.ts`
- `audit/audit.service.ts`
- `users/users.service.ts`
- `reports/reports.service.ts`

**If it fails:** Add or expand tests in `Backend/src/<module>/<module>.service.spec.ts` for the file(s) below threshold. Focus on untested branches and functions first.

---

## 6. Backend — Security Audit

**Directory:** `Backend/`
**Command:**
```bash
cd Backend && npm run audit:check
```
**Pass condition:** Exit code 0. No high or critical severity vulnerabilities reported.
**What it checks:** `npm audit --audit-level=high` against all backend dependencies.
**If it fails:** Run `npm audit fix` for auto-fixable issues. For manual fixes, check the advisory and update the specific package. Do not use `--force` unless the breaking change has been reviewed.

---

## 7. Frontend — TypeScript

**Directory:** `Frontend/`
**Command:**
```bash
cd Frontend && npx tsc --noEmit
```
**Pass condition:** No output. Exit code 0.
**What it checks:** Type correctness across all Next.js pages, components, and API clients.
**If it fails:** Fix every type error. Do not use `as any` casts unless truly unavoidable and documented.

---

## 8. Frontend — ESLint

**Directory:** `Frontend/`
**Command:**
```bash
cd Frontend && npx eslint . --max-warnings 0
```
**Pass condition:** No output. Zero errors, zero warnings.
**What it checks:** Next.js rules, React hooks rules (including `react-hooks/set-state-in-effect`), accessibility, and Prettier formatting.

**Common failure patterns and fixes:**
- `react-hooks/set-state-in-effect` — Do not call `setState()` synchronously inside a `useEffect` body. Move `setLoading(true)` to the event handler that triggers the effect dependency change. Initialize loading state as `true` instead of setting it inside the effect.
- `@next/next/no-img-element` — Replace `<img>` with Next.js `<Image>` and add explicit `width` and `height` props.
- `prettier/prettier` — Run `npx eslint . --fix` to auto-correct formatting.

**If it fails:** Run `--fix` first, then fix remaining errors manually:
```bash
cd Frontend && npx eslint . --fix
```

---

## 9. Frontend — Build

**Directory:** `Frontend/`
**Command:**
```bash
cd Frontend && npm run build
```
**Pass condition:** Output ends with `✓ Compiled successfully` (or equivalent). No errors.
**What it checks:** Full Next.js production build. Catches missing environment variables, invalid page props, and hydration issues that ESLint does not catch.
**If it fails:** Read the build error carefully. Common causes: missing `NEXT_PUBLIC_API_URL` in `.env.local`, a page component missing a default export, or an invalid dynamic route.

---

## 10. Root — Secret Scan

**Directory:** Project root (`cicc/`)
**Command:**
```bash
secretlint "**/*"
```
**Pass condition:** No output. Zero secrets detected.
**What it checks:** Scans all files for accidentally committed credentials, API keys, JWT secrets, and connection strings.
**If it fails:** Remove the secret from the file immediately. If it was already committed, rotate the credential. Never use `--allow-dirty` to bypass this check.

---

## 11. Root — Dependency Audit (Frontend)

**Directory:** `Frontend/`
**Command:**
```bash
cd Frontend && npm run audit:check
```
**Pass condition:** Exit code 0. No high or critical vulnerabilities.
**What it checks:** `npm audit --audit-level=high` for all frontend dependencies.

---

## Runtime Smoke Test (Manual — run after backend is started)

Start the backend first:
```bash
cd Backend && npm run start:dev
```

Then run these curl checks. All must return the expected HTTP status.

### 11a. No token → 401
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/assets
# Expected: 401
```

### 11b. Wrong role → 403
```bash
# Login as Employee and try to access admin audit trail
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrEmployeeId":"employee@cicc.gov.ph","password":"Employee@CICC2026!"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/audit
# Expected: 403
```

### 11c. Valid login → 200
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrEmployeeId":"admin@cicc.gov.ph","password":"Admin@CICC2026!"}'
# Expected: 200
```

### 11d. Helmet headers present
```bash
curl -s -I http://localhost:3001/api/v1/auth/login | grep -i "x-content-type\|x-frame\|strict-transport"
# Expected: headers are present (non-empty output)
```

---

## Summary Table

| # | Check | Directory | Command | Pass Condition |
|---|---|---|---|---|
| 1 | TypeScript | Backend | `npx tsc --noEmit` | No output |
| 2 | ESLint | Backend | `npx eslint ... --max-warnings 0` | No output |
| 3 | Build | Backend | `npm run build` | Compiled successfully |
| 4 | Unit Tests | Backend | `npm run test` | 0 failed |
| 5 | Coverage | Backend | `npm run test:cov` | All thresholds met |
| 6 | Dep Audit | Backend | `npm run audit:check` | No high CVEs |
| 7 | TypeScript | Frontend | `npx tsc --noEmit` | No output |
| 8 | ESLint | Frontend | `npx eslint . --max-warnings 0` | No output |
| 9 | Build | Frontend | `npm run build` | Compiled successfully |
| 10 | Secret Scan | Root | `secretlint "**/*"` | No output |
| 11 | Dep Audit | Frontend | `npm run audit:check` | No high CVEs |
| 11a–d | Smoke Tests | — | curl commands | Correct HTTP codes |
