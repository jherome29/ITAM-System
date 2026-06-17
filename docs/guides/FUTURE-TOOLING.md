# Future Tooling — Add These When Ready

These are features and tools that could NOT be added yet because they depend on the frontend being built.
Each item has a specific trigger point — do not add them before that point or they will be incomplete.
This file exists so nothing is forgotten when the time comes.

---

## 1. Idle Session Timeout
**Add when:** The login page and auth context (`Frontend/lib/auth-context.tsx`) are built.

### What it does
Automatically logs out the user after a period of no mouse, keyboard, or click activity. If a CICC employee walks away from their workstation while logged in, anyone who sits down gets full access until the 8-hour JWT expires. An idle timeout closes that window.

### Why it matters for CICC
Law enforcement workstations are shared in shift environments. A forgotten logged-in session is a real insider-threat and walk-up attack surface.

### Target timeout
15 minutes of inactivity — then auto-logout and redirect to `/login`.

### How to add it
Create `Frontend/lib/idle-timeout.ts` and call it from the root layout once the user is authenticated:

```typescript
// Frontend/lib/idle-timeout.ts
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function startIdleTimer(onTimeout: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;

  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(onTimeout, IDLE_TIMEOUT_MS);
  };

  const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
  events.forEach(e => window.addEventListener(e, reset));
  reset(); // start immediately

  // Returns a cleanup function
  return () => {
    clearTimeout(timer);
    events.forEach(e => window.removeEventListener(e, reset));
  };
}
```

Wire it into the auth context:
```typescript
// Inside AuthContext provider, after login:
useEffect(() => {
  if (!accessToken) return;
  const cleanup = startIdleTimer(() => {
    void logout(); // calls POST /api/v1/auth/logout, clears token from state
  });
  return cleanup;
}, [accessToken]);
```

> Add this in the same session you build the auth context — it is a 30-minute addition.

---

## 2. MFA / TOTP (Multi-Factor Authentication)
**Add when:** The login page is built and working end-to-end.

### What it does
Requires users to enter a 6-digit one-time code from an authenticator app (Google Authenticator, Microsoft Authenticator) in addition to their password. Even if a password is stolen, the attacker cannot log in without the physical device.

This is the single most impactful security control missing from the system. For a cybercrime law enforcement agency, MFA is a near-requirement.

### Standard used
TOTP — Time-Based One-Time Password (RFC 6238). The same standard used by banks, Google, and all major government systems.

### Backend work (add this when building the login page)
```bash
# Backend
npm install otplib qrcode
npm install --save-dev @types/qrcode
```

**New columns on the `users` table:**
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret      VARCHAR(255),   -- encrypted TOTP seed
  ADD COLUMN IF NOT EXISTS totp_enabled     BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMP WITH TIME ZONE;
```

**New fields on `UserEntity`:**
```typescript
@Column({ nullable: true, select: false })
totpSecret!: string | null;

@Column({ default: false })
totpEnabled!: boolean;
```

**Updated login flow in `AuthService`:**
```typescript
import { authenticator } from 'otplib';

// After password validation succeeds:
if (user.totpEnabled) {
  if (!totpCode) {
    throw new UnauthorizedException('MFA code required.');
  }
  const isValidTotp = authenticator.verify({
    token: totpCode,
    secret: user.totpSecret!, // decrypt before passing
  });
  if (!isValidTotp) {
    throw new UnauthorizedException('Invalid MFA code.');
  }
}
// Proceed with issuing tokens...
```

**New endpoints needed:**
- `POST /api/v1/auth/mfa/setup` — generates TOTP secret + QR code for enrollment (IT Personnel role for user setup, or self-service)
- `POST /api/v1/auth/mfa/verify` — confirms the user scanned the QR code correctly (first-time activation)
- `POST /api/v1/auth/mfa/disable` — Admin only

### Frontend work (add alongside login page)
- Login form gains a third step: after password accepted, if `requiresMfa: true` in the response, show a "Enter your 6-digit code" input before issuing the access token
- MFA enrollment screen: show QR code, ask user to scan it, confirm with one code entry

### Phased rollout suggestion
1. Build backend endpoints first
2. Add the MFA code field to the login form
3. Admin enrolls IT Personnel accounts first (highest privilege)
4. Roll out to Supervisors, then Employees
5. Management and System Admin accounts: MFA mandatory from day one

> This is approximately 1 sprint of work. Do not attempt it mid-frontend-build — finish the login page first, confirm the basic auth flow works, then layer MFA on top.

---

## 3. Husky + lint-staged
**Add when:** The team creates a Git repository (`git init`) for the project.

### What it does
Every time anyone on the team runs `git commit`, Husky automatically runs ESLint and the test suite first. If either fails, the commit is blocked. Nobody can ever accidentally push broken code.

### Why it matters for CICC
One teammate commits a file with a hardcoded JWT secret, or a failing test — it goes straight to main without anyone noticing. Husky makes that physically impossible.

### How to add it
```bash
# From project root
npm install --save-dev husky lint-staged
npx husky init

# .husky/pre-commit
cd Backend && npm run lint && npm run test
cd ../Frontend && npm run lint
```

Add to root `package.json`:
```json
"lint-staged": {
  "Backend/src/**/*.ts": ["eslint --fix"],
  "Frontend/**/*.{ts,tsx}": ["eslint --fix"]
}
```

> Requires an active Git repo. Run `git init` at the project root first.
> The project currently has no `.git` folder — Husky cannot be set up until then.

---

## 2. OWASP ZAP (Dynamic Application Security Testing)
**Add when:** Before the Testing & Evaluation phase starts — August 16, 2026.

### What it does
OWASP ZAP is a free security scanner from OWASP. It runs against your **live running system** (both frontend and backend must be up) and automatically probes for vulnerabilities: SQL injection attempts, XSS, broken authentication, sensitive data exposure, misconfigured headers, and more.

It is a **DAST tool** (Dynamic Application Security Testing) — meaning it tests the real running app, not just the source code.

### Why it matters for the capstone
Your capstone requires OWASP ASVS compliance evidence. A ZAP scan report is direct, official DAST evidence you can attach to your capstone paper. It shows the system was tested against real attack patterns, not just reviewed on paper.

### How to run it
1. Download OWASP ZAP from [zaproxy.org](https://www.zaproxy.org/)
2. Start the backend (`npm run start:dev` in Backend/) and frontend (`npm run dev` in Frontend/)
3. In ZAP: File → New Session → Automated Scan → set target to `http://localhost:3000`
4. Run the full scan — it will crawl all pages, test all API endpoints
5. Generate report: Report → Generate Report → HTML or PDF
6. Attach the report to the capstone appendix

### Before running ZAP
Make sure these are working first:
- Login page renders and accepts credentials
- At least the IT Personnel asset pages are accessible
- All API endpoints are reachable

> Schedule this for the first week of the Testing phase. Do not leave it for the last day.

---

## 3. Playwright (End-to-End Browser Testing)
**Add when:** The frontend is complete and all pages are built.

### What it does
Playwright controls a real browser (Chrome, Firefox, or Safari) and simulates exactly what a user does — navigating pages, clicking buttons, filling forms, and reading results. It tests the entire system working together: frontend + backend + database all running simultaneously.

This is different from Jest, which tests individual functions in isolation. Playwright proves the whole workflow works end-to-end.

### Example test
```typescript
test('Employee can submit a requisition', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('[name="email"]', 'juan@cicc.gov.ph');
  await page.fill('[name="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  await page.goto('/employee/requisitions/new');
  await page.selectOption('[name="assetType"]', 'ICT');
  await page.fill('[name="justification"]', 'Need a replacement laptop');
  await page.click('text=Submit Request');

  await expect(page.locator('text=Request submitted')).toBeVisible();
});
```

### Why it matters for the capstone
Playwright generates test reports (HTML, screenshots, videos) that serve as direct UAT evidence. Instead of manually walking evaluators through every feature, you run the test suite and show the report. The capstone requires documented UAT — Playwright automates it.

### Key workflows to test
Once the frontend is complete, write Playwright tests for these critical paths:

| Test | What it covers |
|---|---|
| Employee login → submit requisition | Full requester journey |
| Supervisor login → approve requisition | Approval workflow |
| IT Personnel → fulfill requisition → asset status changes | Fulfillment + lifecycle |
| Employee tries to access `/admin` → redirected | RBAC enforcement |
| Login with wrong password 5× → account locked | Lockout flow |
| Logout → refresh token cleared → protected routes blocked | Session termination |

### How to add it
```bash
# In project root
npm install --save-dev @playwright/test
npx playwright install chromium

# Create playwright.config.ts at project root
# Create e2e/ folder for test files
```

> Playwright needs both the frontend AND backend running simultaneously.
> Do not set this up until the frontend is complete.
> Schedule setup for the first sprint of the Testing & Evaluation phase.

---

## Summary

| # | Tool | Add when | Time to set up |
|---|---|---|---|
| 1 | Idle session timeout | Auth context is built (first frontend session) | ~30 minutes |
| 2 | MFA / TOTP | Login page is working end-to-end | ~1 sprint |
| 3 | Husky + lint-staged | Git repo is initialized (`git init`) | ~30 minutes |
| 4 | OWASP ZAP | Before Aug 16, 2026 — Testing phase starts | ~2 hours (scan + report) |
| 5 | Playwright E2E tests | All frontend pages are complete | ~1 sprint |
