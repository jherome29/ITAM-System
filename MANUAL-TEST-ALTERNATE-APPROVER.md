# Manual Test Checklist — Alternate Approver

Feature branch: `feature/alternate-approver` (stacked on `feature/system-config`).
CLAUDE.md §5 ("Alternate approver — Primary supervisor unavailable — System-designated
backup approver") and §17 ("System must support designation of backup approvers").

## What changed (so you know what you're looking at)

When a requisition's primary supervisor is **unavailable**, approval is handed to a
**designated backup supervisor** and an "Alternate approver" notification fires. Two paths:

- **Planned absence** — the supervisor (or an admin) marks the account unavailable.
  New requisitions for that section route straight to the alternate at submit time.
- **Unplanned silence** — a requisition blows its 24h approval SLA with no decision.
  The hourly watcher (or the manual `run-checks`) reassigns it to the alternate.

Both paths **reassign `requisitions.supervisor_id`** to the alternate (so the existing
approve/reject ownership check just works) and stamp `requisitions.alternate_routed_at`.
Every hand-off writes one `requisition_reassigned` audit entry.

New surfaces:
- **Master Admin → Users** (`/master-admin/users`): open a *supervisor* account → a new
  **"Approval routing"** panel (alternate-approver dropdown + "Currently unavailable"
  toggle + optional until-date).
- **Approving Officer dashboard** (`/approving-officer/dashboard`): a **"My availability"**
  card (self-service toggle + optional until-date).
- **Notifications**: `alternate_approver` alerts show the amber warning icon.
- **Audit trail**: a new **"Requisition Reassigned"** action + filter option.
- **Requisition timeline** (employee `/employee/requisitions/[id]`): a *"Routed to
  alternate approver"* step.

New API:
- `PATCH /api/v1/users/:id` now also accepts `alternateApproverId`, `unavailable`,
  `unavailableUntil` (System Admin only, supervisor rows only).
- `PATCH /api/v1/users/me/availability` — supervisor self-service (`{ unavailable,
  unavailableUntil }`), writes only the caller's own row.
- `GET /api/v1/users?role=supervisor` — new optional role filter.

---

## 0. Setup

- [ ] **Apply migration 007.** In the Supabase SQL editor, run
      `Database/schemas/007_alternate_approver.sql` **statement by statement** (the
      `ALTER TYPE ... ADD VALUE` line must run outside a transaction). It adds
      `users.alternate_approver_id` / `users.unavailable` / `users.unavailable_until`,
      `requisitions.alternate_routed_at`, and the `requisition_reassigned` audit-enum value.
- [ ] **Restart the backend** (`npm run start:dev`) after applying 007 — the running
      process's connection pool needs to pick up the new enum value.
- [ ] Frontend running (`npm run dev`), pointed at that backend.
- [ ] **Accounts.** You have exactly one supervisor today, so create a second one:
      log in as **System Admin** (`admin@cicc.gov.ph` / `Admin@CICC2026!`) →
      **`/master-admin/users`** → **Create account** → role **Supervisor**, any
      division/section, e.g. `alt.supervisor@cicc.gov.ph`. Note its password.
      Working set for this checklist:
      | Role | Login | Notes |
      |---|---|---|
      | System Admin | `admin@cicc.gov.ph` / `Admin@CICC2026!` | designates + audits |
      | Primary supervisor | `supervisor@cicc.gov.ph` / `Supervisor@CICC2026!` | `Operations / Field Operations` |
      | **Alternate supervisor** | the account you just created | the backup |
      | Employee | `employee@cicc.gov.ph` / `Employee@CICC2026!` | `Operations / Field Operations` → routes to the primary supervisor |
      (Adjust passwords if yours differ.)
- [ ] Optional helper for the API/DB checks — an admin token:
      ```powershell
      $H = @{ Authorization = "Bearer " + (Invoke-RestMethod http://localhost:3001/api/v1/auth/login -Method Post -ContentType application/json -Body '{"emailOrEmployeeId":"admin@cicc.gov.ph","password":"Admin@CICC2026!"}').data.accessToken }
      ```

---

## A. Schema & panel wiring

- [ ] **Columns exist.** In Supabase:
      `select column_name from information_schema.columns where table_name='users' and column_name in ('alternate_approver_id','unavailable','unavailable_until');`
      → 3 rows. And `select column_name from information_schema.columns where table_name='requisitions' and column_name='alternate_routed_at';` → 1 row.
- [ ] **Panel shows only for supervisors.** `/master-admin/users` → open the **employee**
      account → **no** "Approval routing" panel. Open a **supervisor** account → the panel
      **is** there (Alternate approver dropdown, "Currently unavailable" checkbox,
      "Unavailable until" date).
- [ ] The alternate dropdown lists **supervisors only** (not employees/admins) and does
      **not** list the supervisor you're editing (no self-designation).

---

## B. Designate an alternate (happy path)

- [ ] `/master-admin/users` → open **`supervisor@cicc.gov.ph`** → Approval routing →
      set **Alternate approver** = your alternate supervisor → **Save approval routing**.
- [ ] Green "Approval routing saved." message. Button is briefly disabled while saving.
- [ ] Close and reopen the drawer → the dropdown still shows the alternate you picked
      (the parent list was updated in place — no full refresh needed).
- [ ] Confirm in Supabase:
      `select email, alternate_approver_id from users where email='supervisor@cicc.gov.ph';`
      → `alternate_approver_id` is the alternate's UUID.
- [ ] **"— none —" clears it.** Set the dropdown back to "— none —", Save, reopen → blank;
      DB shows `alternate_approver_id` NULL. Then set it back to the alternate for the rest
      of the checklist.

---

## C. Designation validation

- [ ] In the panel, the dropdown can't offer the supervisor themselves, so self-designation
      isn't reachable from the UI. Via API it's rejected — as admin:
      ```powershell
      $sup = (Invoke-RestMethod "http://localhost:3001/api/v1/users?role=supervisor" -Headers $H).data.data
      $primaryId = ($sup | Where-Object { $_.email -eq 'supervisor@cicc.gov.ph' }).id
      Invoke-RestMethod "http://localhost:3001/api/v1/users/$primaryId" -Method Patch -Headers $H -ContentType application/json -Body ('{"alternateApproverId":"' + $primaryId + '"}')
      ```
      → **400** "A supervisor cannot be their own alternate."
- [ ] Point it at the **employee's** id → **400** "Alternate approver must be an active supervisor."
- [ ] Try the availability fields on a **non-supervisor** row (the employee's id):
      `... -Body '{"unavailable":true}'` → **400** "Alternate approver and availability apply only to supervisors."
- [ ] Malformed body — `... -Body '{"unavailable":null}'` on the supervisor's id →
      **400** "unavailable must be true or false" (not a 500).

---

## D. Supervisor self-service availability

- [ ] Log in as **`supervisor@cicc.gov.ph`** → you land on the **Approval Dashboard**
      (`/approving-officer/dashboard`). Find the **"My availability"** card.
- [ ] It reflects current state (unchecked, no date — the supervisor is available).
- [ ] Tick **"I'm unavailable — route my approvals to my alternate"**, set **Until** to a
      date a few days out, click **Save availability**.
- [ ] Note reads *"Marked unavailable — new requisitions route to your alternate."*
      Button disables while saving.
- [ ] **Hard-refresh the page** (Ctrl+F5). The card must come back **still checked** with
      the same date — not reset to unchecked. *(This was a bug that got fixed — a reset here
      means a regression.)*
- [ ] Confirm in Supabase:
      `select email, unavailable, unavailable_until from users where email='supervisor@cicc.gov.ph';`
      → `unavailable = true`, `unavailable_until` = your date.
- [ ] Audit: `/management/audit-trail` (or `/admin/audit-trail`) → filter **Action** =
      **User Updated** → the newest row is by the supervisor themselves, on their own
      account, `metadata.self = true`.

---

## E. Planned-absence routing (the core path)

Primary supervisor is unavailable (from D) **and** has an alternate designated (from B).

- [ ] Log in as **`employee@cicc.gov.ph`** → **New Requisition** → submit any request
      (asset type ICT, class SEP, qty 1, a justification, a required date). Note the
      request number (`REQ-…`).
- [ ] **The alternate — not the primary — owns it.** Log in as the **alternate supervisor**
      → **Approval Queue** (`/approving-officer/approvals`) → the new `REQ-…` is there.
      Log in as **`supervisor@cicc.gov.ph`** (the primary) → their Approval Queue does
      **not** contain it.
- [ ] **Alternate got the notification.** As the alternate → **Notifications** →
      a *"Requisition Routed to You (Alternate Approver)"* entry, message reading
      *"…routed to you because <primary name> is unavailable…"*, with the **amber**
      warning icon (not blue).
- [ ] **Timeline shows the hand-off.** As the **employee** → **My Requisitions** →
      open that `REQ-…` → the progress timeline has a **"Routed to alternate approver"**
      step between "Submitted for approval" and any decision.
- [ ] **Audit entry.** `/management/audit-trail` → filter **Action** =
      **Requisition Reassigned** → a row for this requisition. Check its metadata:
      `reason: "primary_unavailable"`, `primaryApproverId` = the primary's id,
      `alternateApproverId` = the alternate's id.
      (Or in Supabase: `select action, metadata from audit_logs where action='requisition_reassigned' order by timestamp desc limit 1;`)
- [ ] **The alternate can actually approve it.** As the alternate → open the requisition →
      **Approve** → succeeds, status goes to `pending_fulfillment`. (This proves the
      "reassign, don't widen" model — the ownership check passed for the alternate because
      `supervisor_id` is now theirs.)

---

## F. No usable alternate → keeps the primary

- [ ] As admin, clear the designation: `/master-admin/users` → `supervisor@cicc.gov.ph` →
      Alternate approver = **"— none —"** → Save. (Primary is still marked unavailable.)
- [ ] As the **employee**, submit another requisition.
- [ ] It routes to the **primary** anyway (check the primary's Approval Queue — the new
      `REQ-…` is there). A queued item beats a dropped one; the SLA watcher is the backstop.
      In Supabase the row's `alternate_routed_at` is **NULL** and `supervisor_id` is the
      primary's id.
- [ ] Re-set the alternate (Approval routing → pick the alternate → Save) before continuing.

---

## G. Primary available again → routes back to the primary

- [ ] Log in as **`supervisor@cicc.gov.ph`** → My availability card → **untick**
      "I'm unavailable" → **Save availability** ("Marked available.").
- [ ] As the **employee**, submit another requisition.
- [ ] It goes to the **primary's** Approval Queue (not the alternate's). `alternate_routed_at`
      is NULL for this one.

---

## H. SLA-breach reassignment (unplanned path)

Primary supervisor **available** (from G), alternate still designated (from B/F).

- [ ] As the **employee**, submit a requisition. Note the `REQ-…`. It sits in the
      **primary's** queue (primary is available).
- [ ] Age it past its 24h SLA. In Supabase:
      ```sql
      update requisitions
         set submitted_at = now() - interval '48 hours',
             sla_deadline = now() - interval '24 hours',
             sla_breach_notified_at = null,
             alternate_routed_at = null
       where request_number = '<REQ-…>';
      ```
- [ ] Trigger the watcher (or wait for the top of the hour):
      ```powershell
      Invoke-RestMethod http://localhost:3001/api/v1/notifications/run-checks -Method Post -Headers $H
      ```
      → `slaBreaches` ≥ 1.
- [ ] **The primary still got the SLA-breach notice** — as `supervisor@cicc.gov.ph` →
      Notifications → an *"SLA Breach — Requisition Overdue"* entry for this `REQ-…`.
      (The breach notice goes to the primary *before* the hand-off — that ordering matters.)
- [ ] **It was reassigned to the alternate** — as the alternate supervisor → Approval Queue
      → the `REQ-…` is now there; Notifications → a *"Requisition Reassigned to You"* entry
      (amber). The primary's queue no longer shows it.
- [ ] In Supabase:
      `select request_number, supervisor_id, alternate_routed_at from requisitions where request_number='<REQ-…>';`
      → `supervisor_id` = the alternate's id, `alternate_routed_at` set.
- [ ] Audit: **Requisition Reassigned** row for this requisition with
      `metadata.reason = "sla_breach"` and `metadata.systemInitiated = true`.
- [ ] Run `run-checks` **again** → this requisition is **not** reassigned or re-notified a
      second time (the `alternate_routed_at` stamp + the `sla_breach_notified_at` stamp both
      guarantee one-shot).

---

## I. Audit trail surface

- [ ] `/management/audit-trail` (or `/admin/audit-trail`) → the **Action** filter dropdown
      contains **"Requisition Reassigned"**.
- [ ] Selecting it lists only the reassignment rows from E and H. Each shows the acting
      user (the requester), the affected requisition, and the `reason` metadata.
- [ ] These rows are append-only like every audit row — there's no edit/delete affordance.

---

## J. Access control

- [ ] Log in as **`employee@cicc.gov.ph`**. From the browser console or your REST client,
      with the **employee's** token:
      - `PATCH /api/v1/users/me/availability` `{ "unavailable": true }` → **403**
        (route is supervisors + admin only).
      - `PATCH /api/v1/users/<any id>` `{ "alternateApproverId": "…" }` → **403**
        (System Admin only).
- [ ] The employee has no "My availability" card and no "Approval routing" panel anywhere
      in their UI.

---

## K. Regression — nothing else moved

- [ ] With the primary **available** and **no** alternate weirdness in play, the normal
      requisition flow is unchanged: employee submits → **primary** supervisor approves or
      rejects → (approve) IT fulfillment queue → issue. Same as before this feature.
- [ ] A reject by the primary still works and still notifies the requester.
- [ ] The **System Config** page and everything from that feature still behave (this branch
      is stacked on it, not replacing it).

---

## Known limitations (expected — not bugs to chase here)

- **"Unavailable until" is date-granularity.** A date like `2026-09-15` is interpreted as
  `00:00Z` = **08:00 Manila on the 15th**, so availability returns mid-morning *on* that
  day, not at its end. Pick the day *after* you actually return, or treat the field as
  "available again on".
- **After an SLA hand-off, the alternate inherits an already-blown deadline.** There's no
  fresh SLA clock for the alternate and no second escalation — an unresponsive alternate
  is a silent dead end (this follows the spec's "one hop, no chain of alternates" rule).
- **The "Routed to alternate approver" timeline row is only on the employee's requisition
  detail.** The Approving Officer's own requisition-detail view is still a mock screen, so
  the approver doesn't see that step in context yet.
- **The alternate dropdown pulls up to 200 supervisors.** Fine for CICC's headcount; if the
  supervisor list ever exceeds that, the backend `?role=supervisor` filter already narrows
  it server-side.

---

## When you're done — restore state

- [ ] `supervisor@cicc.gov.ph`: **available** (unavailable unticked), and set the alternate
      back to whatever you want it to be for demos (or "— none —").
- [ ] Delete the test requisitions you created (they'll otherwise sit in a queue forever):
      in Supabase, for each `REQ-…` — `delete from notifications where related_record_id = (select id from requisitions where request_number='<REQ-…>'); delete from requisition_approvals where requisition_id = (select id from requisitions where request_number='<REQ-…>'); delete from requisition_items where requisition_id = (select id from requisitions where request_number='<REQ-…>'); delete from requisitions where request_number='<REQ-…>';`
      The `requisition_reassigned` **audit rows stay** (append-only, by design).
- [ ] Keep or deactivate the second supervisor account as you prefer — it's harmless to leave.
