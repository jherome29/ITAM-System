# PHASE 2 — Backend Endpoint Testing
### Goal: Confirm the backend actually works before connecting the frontend
### Time: 30 minutes
### Tool: Postman — not Claude Code
### Do this: TODAY, right after Phase 1

> If you skip this and go straight to frontend, you will waste hours
> debugging issues that are easier to catch here first.

---

## What You Are Testing

4 core API calls that the frontend depends on.
If any of these fail, fix them before building any frontend page.

---

## Test A — Login returns a JWT

```
Method: POST
URL:    http://localhost:3001/api/v1/auth/login
Body (JSON):
{
  "email": "admin@cicc.gov.ph",
  "password": "your-test-password"
}

Expected response:
{
  "data": { "accessToken": "eyJ..." },
  "message": "Login successful",
  "statusCode": 200
}
```

✅ Copy the accessToken value. You need it for tests B, C, D.

---

## Test B — Get asset list

```
Method: GET
URL:    http://localhost:3001/api/v1/assets
Headers:
  Authorization: Bearer [paste accessToken from Test A]

Expected response:
{
  "data": [ ...array of asset objects... ],
  "message": "Assets retrieved",
  "statusCode": 200
}
```

---

## Test C — Get requisitions filtered by role

```
Method: GET
URL:    http://localhost:3001/api/v1/requisitions
Headers:
  Authorization: Bearer [paste accessToken from Test A]

Expected response:
  List of requisitions matching the logged-in user's role
  Employee sees only their own
  Supervisor sees pending ones
  IT Personnel sees approved ones
```

---

## Test D — Create a requisition

```
Method: POST
URL:    http://localhost:3001/api/v1/requisitions
Headers:
  Authorization: Bearer [paste accessToken from Test A]
Body (JSON):
{
  "itemType": "SEP",
  "itemName": "Dell Latitude 5420 Laptop",
  "quantity": 1,
  "priority": "High",
  "justification": "Required for field operations"
}

Expected response:
  201 Created
  The new requisition object in "data"
```

---

## If a Test Fails

Fix it in Claude Code before moving to frontend. Use this prompt:

```
Read CLAUDE.md and SECURITY.md.

This endpoint is not working correctly:
[paste the endpoint URL and method]

Error I got:
[paste the error response]

What I expected:
[paste what you expected]

Find the issue and fix it.
```

---

## ✅ Checklist — confirm before moving to Phase 3

- [ ] Test A passes — login returns a valid accessToken
- [ ] Test B passes — GET /assets returns asset array
- [ ] Test C passes — GET /requisitions returns role-filtered list
- [ ] Test D passes — POST /requisitions returns 201 with new record
- [ ] No unexpected errors on any test

---

## Next Step

Go to `docs/phases/PHASE-3-FRONTEND.md`
