# CONTEXT RESET — Start of Every Claude Code Session
### Use this: At the beginning of EVERY new Claude Code session
### Without exception

> Claude Code has no memory between sessions.
> Every new session starts blank.
> This prompt re-anchors Claude before you give it any task.

---

## Copy This — Fill in the Blank — Paste First

```
Read CLAUDE.md and SECURITY.md thoroughly.
Do not start writing any code until you confirm you have read both.

We are building AIMRS — the Asset Inventory Management and
Requisition System for CICC (Cybercrime Investigation and
Coordinating Center).

Today I am working on:
[describe what you are building in this session]

Before starting, confirm you understand:
1. Folder structure: Frontend/ Backend/ Database/ packages/shared/
2. All 5 user roles: Employee, Supervisor, IT Personnel,
   System Admin, Management
3. Security rules from SECURITY.md are mandatory — not optional
4. API base URL: http://localhost:3001/api/v1
5. Every API response uses envelope format:
   { "data": ..., "message": "...", "statusCode": 200 }

Reply with a short summary of what you understood before proceeding.
```

---

## What to Fill In

Replace `[describe what you are building in this session]` with
something specific. Examples:

| What you're doing | What to write |
|---|---|
| Security audit | the security audit of the existing backend modules |
| Login page | the login page frontend at Frontend/app/(auth)/login/page.tsx |
| Shared layout | the shared sidebar and header layout component |
| Employee dashboard | the employee dashboard page |
| Asset inventory | the asset inventory page for IT Personnel |
| COA forms | the PAR PDF generator in Backend/src/reports/par/ |
| Jest tests | Jest security tests for the auth and assets modules |

---

## What to Do After Claude Confirms

Once Claude Code replies with its summary of what it understood,
check that it mentioned:
- The correct folder names (Frontend/ Backend/ not apps/web apps/api)
- Security rules are mandatory
- The envelope response format

If it missed any of those, correct it before giving the task:

```
One correction: the folder is called Frontend/ not apps/web.
Always use Frontend/ and Backend/ for this project.
```

Then give it the actual task.
