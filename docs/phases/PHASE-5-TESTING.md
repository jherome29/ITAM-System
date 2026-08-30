# PHASE 5 — Security Verification and Testing
### Goal: Prove the system is secure and meets the 70% coverage requirement
### Time: August 16 – September 15
### Do this: After the full system is built and running

> This phase is your testing chapter evidence.
> Everything here gets documented in your capstone paper.
> Run all tools, save all reports, fix all HIGH severity findings.

---

## What Claude Code Reads This Session

```
CLAUDE.md + SECURITY.md
```

---

## Step 5.1 — Jest Security Tests

> **Can start before the rest of Phase 5.** Security tests accumulate rather than
> expire when new features are added, so seeding this suite early gives you a CI
> gate that catches regressions during the remaining build. Steps 5.3–5.5 (ZAP,
> JMeter, UAT) test the whole system surface and are best run once, at the end.
> Seeded 2026-08-30 — see `PATH-TO-DONE.md` §C.
>
> **Run the e2e suite locally** (needs Docker Desktop running):
> `cd Backend && npm run test:e2e:local` — or `… -- security.e2e-spec` for one
> file. It spins a throwaway `postgres:16` (`docker-compose.e2e.yml`, tmpfs) with
> `NODE_ENV=test`, exactly like CI's `backend-e2e` job, then tears it down.
> Plain `npm run test:e2e` points at Supabase and will not connect from jest.

Paste this into Claude Code to generate the security test suite:

```
Read CLAUDE.md and SECURITY.md.

Write security-specific Jest tests for the Backend/.
Place them in Backend/test/security/

Cover all of these scenarios:

1. Privilege escalation
   Employee calling an IT Personnel endpoint → must return 403
   Supervisor calling an Admin endpoint → must return 403

2. No token
   Any protected endpoint with no Authorization header → must return 401

3. Tampered JWT
   Modify any character in a valid JWT → must return 401

4. Account lockout
   5 failed login attempts → account is locked
   6th attempt → must return 401 with lockout message
   (do not reveal exact unlock time)

5. Rate limiting
   11 login attempts within 1 minute → must return 429 on the 11th

6. Audit log immutability
   Attempt an UPDATE on the audit_logs table → must throw an error
   Attempt a DELETE on the audit_logs table → must throw an error

7. Input validation / SQL injection attempt
   Send a malformed DTO with extra fields → must return 400
   Send SQL injection string as input → must return 400, never reach DB

8. Sensitive data in responses
   Login response → must not contain passwordHash or refreshTokenHash
   Any user response → must not contain password fields

Run with: cd Backend && npm run test:e2e:local -- security.e2e-spec   (needs Docker)
All 8 scenarios must pass before this phase is complete.
```

---

## Step 5.2 — Overall Jest Coverage Report

Run this in your Backend/ terminal:

```bash
cd Backend
npm run test -- --coverage
```

The report shows coverage percentage per file.
Every file must be 70% or above.

If any file is below 70%, paste this into Claude Code:

```
Read CLAUDE.md. The following files are below 70% test coverage:
[paste the list of files and their coverage percentages]

Write the missing tests to bring each file above 70%.
Place tests in the same test folder structure as the source.
```

---

## Step 5.3 — OWASP ZAP Automated Security Scan

OWASP ZAP is a free tool that automatically scans your running
system for security vulnerabilities. It is industry standard
and your capstone paper can cite it as evidence.

**Setup:**
1. Download OWASP ZAP from `https://www.zaproxy.org`
2. Make sure the full system is running locally:
   - Backend: `http://localhost:3001`
   - Frontend: `http://localhost:3000`
3. Open ZAP

**Running the scan:**
1. In ZAP: click "Automated Scan"
2. Enter URL: `http://localhost:3001`
3. Click "Attack"
4. Wait 15–30 minutes for it to finish
5. When done: Reports → Generate Report → PDF
6. Save the report as `zap-scan-report.pdf`

**Reading the report:**
- HIGH severity findings → must fix before UAT
- MEDIUM severity findings → fix if possible, document if not
- LOW severity findings → document in paper, fix if time allows
- INFORMATIONAL → note only, no action required

---

## Step 5.4 — Fix ZAP Findings

For each HIGH severity finding from ZAP, paste this into Claude Code:

```
Read CLAUDE.md and SECURITY.md.

OWASP ZAP found this HIGH severity vulnerability:
[paste the finding name and description from ZAP]
[paste the URL it found it on]
[paste the evidence ZAP showed]

Find and fix this vulnerability in the codebase.
Explain what caused it and what the fix does.
```

---

## Step 5.5 — JMeter Load Test (Optional but good for paper)

Apache JMeter tests performance under load — simulating
362 concurrent users as stated in CLAUDE.md.

1. Download Apache JMeter from `https://jmeter.apache.org`
2. Create a test plan:
   - Thread Group: 362 threads (users)
   - Ramp-up: 60 seconds
   - Test the 4 most used endpoints:
     POST /auth/login
     GET /assets
     GET /requisitions
     POST /requisitions
3. Run the test while the system is running locally
4. Save the results report
5. Document average response time and any failures

> For your paper: the system should handle 362 concurrent users
> with average response time under 2 seconds. If it cannot,
> that is a finding to document and address.

---

## What Goes in Your Capstone Paper

From this phase you have:

| Evidence | Where to put it in paper |
|---|---|
| Jest test results (all passing) | Testing chapter — unit testing section |
| Coverage report (70%+) | Testing chapter — coverage section |
| ZAP scan report PDF | Testing chapter — security testing section |
| ZAP findings and fixes | Testing chapter — vulnerability remediation |
| JMeter results | Testing chapter — performance testing section |

---

## ✅ Checklist — confirm before UAT with CICC

- [ ] All 8 security Jest test scenarios pass
- [ ] Overall test coverage is 70% or above on all modules
- [ ] OWASP ZAP scan completed and report saved
- [ ] All HIGH severity ZAP findings fixed
- [ ] MEDIUM severity findings documented with justification
- [ ] JMeter load test completed (if time allows)
- [ ] All test reports saved for inclusion in capstone paper

---

## Next Step

UAT with CICC — no file needed.
Work directly with your CICC liaison to conduct user acceptance testing.
Document all findings and resolutions in your capstone paper.
