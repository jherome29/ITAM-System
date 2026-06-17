# PHASE 1 — Security Audit of Existing Backend
### Goal: Find and fix everything SECURITY.md requires that is currently missing
### Time: 1 hour
### Do this: TODAY, right after Phase 0

> ⚠️ You built the backend WITHOUT SECURITY.md.
> This phase finds what was missed and fixes it.
> Do not skip this. Do not go to the frontend until this is done.

---

## What Claude Code Reads This Session

```
CLAUDE.md + SECURITY.md
```

---

## Step 1.1 — Open Claude Code

Open VS Code → open the `cicc/` folder → open the integrated terminal → run:

```bash
claude
```

Wait for the prompt cursor to appear.

---

## Step 1.2 — Paste the Audit Prompt

Copy this entire block and paste it into Claude Code as your first message.
Do not change anything:

```
Read CLAUDE.md and SECURITY.md thoroughly before doing anything.

Then audit the existing Backend/ codebase against every
requirement in SECURITY.md. Check each item one by one:

1. Backend/src/main.ts
   - Is Helmet installed and configured? (SECURITY.md section 2)
   - Is CORS restricted to localhost:3000 only? (section 2)
   - Is GlobalExceptionFilter registered? (section 8)
   - Is cookieParser installed? (section 2)
   - Is ValidationPipe set with whitelist:true? (section 2)

2. Backend/src/app.module.ts
   - Is ThrottlerModule installed and configured? (section 3)
   - Is ThrottlerGuard applied globally? (section 3)

3. Backend/src/auth/auth.controller.ts
   - Does login have a @Throttle override of 10 per minute? (section 3)

4. Backend/src/auth/auth.service.ts
   - Is account lockout after 5 failed attempts implemented? (section 4.2)
   - Is timing attack prevention implemented? (section 4.2)
   - Is refresh token stored as bcrypt hash in DB? (section 4.4)
   - Is refresh token sent as httpOnly cookie? (section 4.4)

5. Every controller in Backend/src/
   - Does every endpoint have @UseGuards(JwtAuthGuard, RolesGuard)?
   - Does every endpoint have a @Roles() decorator?

6. Database/schema.sql
   - Is the audit_logs immutability trigger created? (section 6.2)
   - Is UPDATE and DELETE revoked on audit_logs? (section 6.2)

For every item tell me one of three things:
✅ EXISTS and correct
⚠️ EXISTS but wrong — describe what is wrong
❌ MISSING completely

Give me the full audit report. Do NOT fix anything yet.
```

---

## Step 1.3 — Save the Audit Report

When Claude Code finishes the report, copy it and save it as
`audit-report.txt` in your `cicc/` root folder.

Read through it. Count how many ❌ and ⚠️ items there are.

---

## Step 1.4 — Paste the Fix Prompt

After reading the report, paste this into Claude Code:

```
Based on the audit report, fix ALL items marked ⚠️ WRONG
or ❌ MISSING following SECURITY.md exactly.

Fix in this exact order:
1. Backend/src/main.ts
   → add Helmet, CORS, cookieParser, ValidationPipe,
     GlobalExceptionFilter
2. Backend/src/app.module.ts
   → add ThrottlerModule and ThrottlerGuard
3. Backend/src/auth/auth.controller.ts
   → add @Throttle on the login endpoint
4. Backend/src/auth/auth.service.ts
   → fix account lockout and refresh token storage
5. Any controller missing @UseGuards or @Roles
   → fix all of them
6. Database/schema.sql
   → add the audit_logs immutability trigger

Show me each complete file after you change it.
Wait for me to confirm before moving to the next file.
```

> 💡 After Claude Code shows you each fixed file, type
> "looks good, continue" OR "fix this: [describe the issue]"
> before it moves to the next file.

---

## Step 1.5 — Verify in Postman

Run these 4 manual tests in Postman after all fixes are applied:

**Test 1 — No token → must get 401**
```
GET http://localhost:3001/api/v1/assets
Headers: none
Expected: 401 Unauthorized
```

**Test 2 — Wrong role → must get 403**
```
GET http://localhost:3001/api/v1/assets
Headers: Authorization: Bearer [Employee JWT token]
Expected: 403 Forbidden
```

**Test 3 — Too many logins → must get 429**
```
POST http://localhost:3001/api/v1/auth/login
Body: { "email": "test@cicc.gov.ph", "password": "wrongpassword" }
Do this 11 times rapidly
Expected: 429 Too Many Requests on the 11th attempt
```

**Test 4 — Helmet headers → must be present**
```
Any GET request in Postman
Go to the Headers tab of the response
Expected headers to see:
  X-Frame-Options
  X-Content-Type-Options
  X-XSS-Protection
```

---

## ✅ Checklist — confirm before moving to Phase 2

- [ ] Audit report saved as audit-report.txt
- [ ] All ❌ MISSING items fixed
- [ ] All ⚠️ WRONG items fixed
- [ ] Postman Test 1 passes — 401 with no token
- [ ] Postman Test 2 passes — 403 with wrong role
- [ ] Postman Test 3 passes — 429 after 11 rapid attempts
- [ ] Postman Test 4 passes — Helmet headers visible

---

## Next Step

Go to `docs/phases/PHASE-2-BACKEND-TEST.md`
