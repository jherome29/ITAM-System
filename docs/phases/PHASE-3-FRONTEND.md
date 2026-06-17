# PHASE 3 — Frontend Development
### Goal: Build all pages using your mockup screenshots
### Time: Week 1 to Week 5
### Do this: After Phase 2 is fully complete

> You will be doing this manually — attaching screenshots one page at a time
> and polishing the result yourself. This file gives you the order and
> the general prompt pattern. The details you fill in from your own mockups.

---

## What Claude Code Reads Every Session

```
CLAUDE.md + SECURITY.md + the mockup screenshot you attach
```

Always start every session with the Context Reset prompt.
See `docs/guides/CONTEXT-RESET.md`

---

## The Page Build Order

Build in this exact order. Each one depends on the previous.

```
1. Login Page
   → Everything in the system is gated behind this

2. Shared Layout (sidebar + header)
   → Build this ONCE — every other page uses it
   → Do not build any other page until this is done

3. Employee Pages
   → Dashboard
   → Submit Requisition
   → Status Tracking

4. Supervisor Pages
   → Dashboard + Approval Queue
   → Review Requisition

5. IT Personnel Pages
   → Dashboard
   → Asset Inventory
   → Register New Asset
   → Fulfill Requisition

6. Admin Pages
   → User Management

7. Management Pages
   → Reports Dashboard
```

---

## The General Prompt Pattern for Every Page

Use this structure for every page you build.
Fill in the bracketed parts based on the page you are building:

```
Read CLAUDE.md and SECURITY.md.

I am attaching the mockup screenshot for [page name].

Build [page name] at Frontend/app/[route]/page.tsx
Use <AppLayout> as the wrapper. (skip this for login page only)

Match the mockup layout exactly.

Connect to these API endpoints:
[list the endpoints this page uses — GET or POST]

Requirements:
- Show a loading state while data is fetching
- Show an error message if the API call fails
- Show an empty state if there is no data
- Use Tailwind CSS only
- Follow the SECURITY.md section 10 frontend rules:
  accessToken stored in React context, never localStorage
```

---

## The Shared Layout — Do This Before Any Other Page

The shared layout is the sidebar and header that appears on every page.
Build this before any dashboard or feature page.

General prompt to use:

```
Read CLAUDE.md and SECURITY.md.

I am attaching the mockup showing the shared layout
(sidebar + top header visible in the dashboard screenshots).

Build the shared layout component at
Frontend/components/layout/AppLayout.tsx

The layout has:
- A top header bar with the system name and a Logout button
- A left sidebar with navigation links
- Navigation links must change based on the logged-in user's role
  (get the role from the auth context)
- A main content area where each page renders inside

The Logout button must:
- Call POST /api/v1/auth/logout
- Clear the accessToken from React context
- Redirect to /login

Every page after this must be wrapped with <AppLayout>
```

---

## How to Attach Screenshots

1. In Claude Code, type your prompt first
2. Before sending, drag and drop the PNG file into the chat
3. Then send — Claude Code will see both the text and the image

Attach one screenshot per page prompt. Do not attach multiple at once.

---

## After Claude Code Builds Each Page

Claude Code will generate the page code. Then you:

1. Run `npm run dev` in the Frontend/ folder
2. Open the browser at `http://localhost:3000`
3. Navigate to the page
4. Compare it against your mockup screenshot manually
5. Note what needs to be changed
6. Either fix it yourself or tell Claude Code specifically what to fix

> You said you want to manually polish the pages yourself.
> That is the right approach — Claude Code gets it 80% right,
> you bring it to 100% by reviewing it visually.

---

## When You Find Something That Needs Fixing

Tell Claude Code exactly what is wrong. Be specific:

```
The sidebar background color is wrong. It should be dark navy
(#1a3a5c) not light gray. Fix only the sidebar background color.
```

The more specific you are, the cleaner the fix.

---

## Auth Context Setup — Do This First Before Any Page

Before building any page, set up the auth context so every page
can access the logged-in user and their token:

```
Read CLAUDE.md and SECURITY.md section 10.

Create the auth context at Frontend/context/AuthContext.tsx

It must store:
- accessToken (string or null)
- user object (id, name, role, employeeId)
- setAccessToken function
- setUser function
- logout function (clears both and redirects to /login)

Create the axios API client at Frontend/lib/api-client.ts
following SECURITY.md section 10.2 exactly:
- Attach accessToken to every request header
- Auto-refresh on 401 response
- Use withCredentials: true for the httpOnly cookie
```

---

## Role-Based Route Protection

After the login page is working, add route protection
so users cannot navigate to pages outside their role:

```
Read CLAUDE.md and SECURITY.md section 10.3.

Create Frontend/middleware.ts for Next.js route protection.
Protect these route groups:
- /employee/* — Employee, Supervisor, IT Personnel, Admin
- /supervisor/* — Supervisor, Admin
- /it-personnel/* — IT Personnel, Admin
- /admin/* — Admin only
- /management/* — Management, Admin

If a user tries to access a route outside their role,
redirect them to /unauthorized
Create a simple /unauthorized page with a message.
```

---

## ✅ Checklist — confirm before moving to Phase 4

- [ ] Auth context and API client built
- [ ] Login page works end to end
- [ ] Shared layout (sidebar + header) built and working
- [ ] Route protection middleware in place
- [ ] All Employee pages connected to real API
- [ ] All Supervisor pages connected to real API
- [ ] All IT Personnel pages connected to real API
- [ ] All Admin pages connected to real API
- [ ] All Management pages connected to real API
- [ ] You have manually reviewed and polished every page
- [ ] No console errors in the browser on any page

---

## Next Step

Go to `docs/phases/PHASE-4-COA-FORMS.md`
