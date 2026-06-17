# IF WRONG — When Claude Code Makes a Mistake
### Use this: Whenever Claude Code contradicts CLAUDE.md or SECURITY.md
### Or when the output is incorrect and you need to correct it

---

## The Correction Prompt

Copy this, fill in the brackets, paste into Claude Code:

```
Stop. This contradicts [CLAUDE.md / SECURITY.md].

[CLAUDE.md / SECURITY.md] section [X] says:
[quote the exact rule that was broken]

What you just did:
[describe specifically what Claude Code did wrong]

Redo this correctly following the rule above.
Do not explain why you did it wrong — just fix it.
```

---

## Common Mistakes and How to Correct Them

**Wrong folder name used**
```
Stop. The folder is called Frontend/ not apps/web.
The folder is called Backend/ not apps/api.
Always use Frontend/ and Backend/ for this project.
Redo the file path correctly.
```

**localStorage used for token storage**
```
Stop. SECURITY.md section 10.1 says:
accessToken must be stored in React context (memory only).
Never in localStorage or sessionStorage.

You used localStorage. Redo this using React context instead.
```

**Missing @UseGuards or @Roles on an endpoint**
```
Stop. SECURITY.md section 5 says:
Every endpoint must have both @UseGuards(JwtAuthGuard, RolesGuard)
and @Roles() decorator. No exceptions.

The [endpoint name] endpoint is missing [which decorator].
Add the correct decorator and specify the allowed roles.
```

**Raw SQL used instead of TypeORM**
```
Stop. SECURITY.md section 6.1 says:
No raw SQL strings anywhere — period.
Use TypeORM QueryBuilder or repository methods only.

You used a raw SQL string. Rewrite this using TypeORM.
```

**Error response exposes internal details**
```
Stop. SECURITY.md section 8 says:
Errors must use the GlobalExceptionFilter and never expose
stack traces, table names, query text, or file paths.

The error response you wrote exposes [what was exposed].
Use the GlobalExceptionFilter pattern from SECURITY.md section 8.
```

**Audit log not created after a state change**
```
Stop. SECURITY.md section 9 says:
Every action that modifies data must create an audit log entry.

The [service method] changes [what data] but has no audit log call.
Add auditService.log() with the correct AuditAction enum value.
```

**Wrong response format**
```
Stop. CLAUDE.md says every response must use the envelope format:
{ "data": ..., "message": "...", "statusCode": 200 }

You returned [describe what was returned instead].
Wrap the response in the envelope format.
```

---

## If Claude Code Keeps Making the Same Mistake

If the same mistake happens more than once in a session,
start a fresh session with the Context Reset prompt and add:

```
Important note: In the previous session you kept [describe the mistake].
Do not repeat this. The correct approach is [describe the correct way].
```

---

## If You Are Not Sure if Something is Wrong

Ask Claude Code directly:

```
Does this follow CLAUDE.md and SECURITY.md?
If not, what needs to change?
```

Claude Code will audit its own output against the rules.
