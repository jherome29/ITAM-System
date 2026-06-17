# How to Prompt Claude Code for Frontend Work

> Use this guide every time you start a new session focused on building a Frontend page.
> Copy the template below, fill in the blanks, and paste it as your opening message.

---

## The Golden Rules

1. **One page per session.** Never ask Claude to "build the entire frontend." Start with one page, finish it, verify it, then move to the next.
2. **Always tell Claude to read the handoff files first.** It starts cold — it has no memory of previous sessions.
3. **Reference the exact API endpoint** the page calls. Claude should never guess at URL paths.
4. **Specify the role** the page belongs to. Claude needs to know which route group and which RBAC context.

---

## Opening Prompt Template

Copy this exactly and fill in the `[brackets]`:

```
Read these files in order before writing any code:
1. SESSION_HANDOFF.md — current system state, all constraints, API endpoints
2. SECURITY.md — security rules (wins over everything on security matters)
3. CLAUDE.md — full project spec, RBAC matrix, business rules

Then build the [PAGE NAME] page for the [ROLE] role.

Route: [e.g. /it-personnel/assets]
File location: Frontend/app/(it-personnel)/assets/page.tsx

API calls this page makes:
- [e.g. GET /api/v1/assets — returns { statusCode, message, data: Asset[] }]
- [e.g. GET /api/v1/assets/stats — returns { statusCode, message, data: { total, available, issued } }]

What the page should show:
- [describe the UI: table, cards, buttons, etc.]
- [reference the CLAUDE.md module description for the page if applicable]

Access token is stored in React context/state (NEVER localStorage).
All API calls go through Frontend/lib/api-client.ts (axios, withCredentials: true).
Use Tailwind CSS for all styling.
TypeScript strict mode — no `any` types.
Do not build any other pages. Only this one.
```

---

## Page Build Order (Follow This Sequence)

Build pages in this order — each one depends on the previous working:

### Phase 1 — Authentication (build this first, everything else needs it)
1. **`/login`** — login form → stores access token in memory → redirects by role
2. **Auth context** (`Frontend/lib/auth-context.tsx`) — React context holding access token, user object, logout function
3. **API client** (`Frontend/lib/api-client.ts`) — axios instance with Bearer token injection + 401 → refresh → retry interceptor
4. **Middleware** (`Frontend/middleware.ts`) — route protection by role

### Phase 2 — IT Personnel (most complex role, best to build early)
5. `/it-personnel/dashboard`
6. `/it-personnel/assets` (asset table)
7. `/it-personnel/assets/new` (register asset form)
8. `/it-personnel/assets/[id]` (asset detail)
9. `/it-personnel/assets/[id]/lifecycle` (status transitions)
10. `/it-personnel/requisitions` (fulfillment queue)
11. `/it-personnel/requisitions/[id]` (fulfill action)

### Phase 3 — Employee
12. `/employee/dashboard`
13. `/employee/requisitions/new`
14. `/employee/requisitions`
15. `/employee/requisitions/[id]` (status timeline)

### Phase 4 — Supervisor
16. `/supervisor/dashboard`
17. `/supervisor/approvals`
18. `/supervisor/approvals/[id]` (approve/reject)

### Phase 5 — Admin & Management
19. `/admin/users`
20. `/admin/users/new`
21. `/admin/audit-trail`
22. `/management/dashboard`

---

## What to Tell Claude About the Auth Flow

Include this in your prompt whenever the page needs authentication:

```
Auth flow reminder:
- Access token: stored in React context (memory only, never localStorage)
- Refresh token: httpOnly cookie set by backend, JS cannot read it
- On app load: call POST /api/v1/auth/refresh to silently re-issue access token if cookie exists
- On 401 from any API call: call POST /api/v1/auth/refresh, retry the original request
- Logout: call POST /api/v1/auth/logout (clears cookie + kills DB token)
- All API calls use withCredentials: true (sends the httpOnly cookie automatically)
- API response envelope: { statusCode: number, message: string, data: T }
```

---

## What to Tell Claude About Shared Components

Once you have built shared components (Sidebar, StatusBadge, DataTable, etc.), tell Claude:

```
Existing shared components (do not rebuild these):
- Frontend/components/Sidebar.tsx — role-based nav, accepts `role` prop
- Frontend/components/StatusBadge.tsx — color-coded chip, accepts `status` prop
- Frontend/components/DataTable.tsx — sortable table, accepts `columns` + `data` props
- Frontend/components/LoadingSkeleton.tsx — skeleton placeholder
```

---

## What NOT to Ask Claude to Do in a Frontend Session

- Do not ask Claude to modify any Backend files
- Do not ask Claude to "make it look nice later" — style it properly the first time with Tailwind
- Do not ask Claude to build multiple pages in one session
- Do not ask Claude to add features not in CLAUDE.md
- Do not ask Claude to set up Next.js — it is already scaffolded in Frontend/

---

## Verifying a Page is Done

Before marking a page complete, confirm:

```
[ ] Page renders without TypeScript errors (npm run build in Frontend/)
[ ] API calls use the correct endpoint from SESSION_HANDOFF.md endpoint table
[ ] Access token is read from auth context, not localStorage
[ ] Loading state shown while API call is in flight
[ ] Error state shown if API call fails (use the message field from response envelope)
[ ] Role guard: unauthenticated users redirected to /login
[ ] All interactive elements (buttons, forms) have proper disabled state during loading
[ ] Tailwind classes only — no inline styles, no CSS modules
```

---

## Example Opening Prompt (Filled In)

```
Read these files in order before writing any code:
1. SESSION_HANDOFF.md — current system state, all constraints, API endpoints
2. SECURITY.md — security rules
3. CLAUDE.md — full project spec

Then build the Asset Inventory page for the IT Personnel role.

Route: /it-personnel/assets
File location: Frontend/app/(it-personnel)/assets/page.tsx

API calls this page makes:
- GET /api/v1/assets — returns { statusCode, message, data: Asset[] }
- GET /api/v1/assets/stats — returns { statusCode, message, data: { total, available, issued, underRepair, flaggedForDisposal } }

What the page should show:
- 5 summary cards at the top (total, available, issued, under repair, flagged for disposal)
- Searchable, filterable asset table below (columns: propertyNumber, itemDescription, brand, assetClass, status, officeOrSection, condition)
- Status badges color-coded by AssetStatus enum value
- "Register New Asset" button that navigates to /it-personnel/assets/new
- Clicking a table row navigates to /it-personnel/assets/[id]

Auth flow reminder:
- Access token in React context (never localStorage)
- API calls via Frontend/lib/api-client.ts with withCredentials: true
- Response envelope: { statusCode, message, data: T }

Use Tailwind CSS. TypeScript strict mode. No `any` types.
Do not build any other pages. Only this one.
```
