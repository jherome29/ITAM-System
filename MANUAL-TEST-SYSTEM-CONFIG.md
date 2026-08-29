# Manual Test Checklist — System Configuration

Covers `feature/system-config`. Go in order, tick things off, write a one-line note next
to anything that fails. Everything here already passes 244 backend unit + 36 frontend
tests + `next build`; this is about confirming it behaves in **your** environment against
**your** Supabase, plus the UI.

Delete this file once you're satisfied.

---

## What changed (so you know what you're looking at)

**New backend module `system-config`:**

| Piece | What it does |
|---|---|
| `system_config` table (migration `006`) | key–value store: `sla_approval_hours`, `default_reorder_level`, `useful_life_years` (`{PPE,SEP,IES}`), `max_login_attempts`. Seeded with today's values (24 / 10 / {5,3,1} / 5). |
| `GET /api/v1/system-config` | System Admin only. Returns `{ slaApprovalHours, defaultReorderLevel, usefulLifeYears:{PPE,SEP,IES}, maxLoginAttempts }`. |
| `PATCH /api/v1/system-config` | System Admin only. Send any subset of those keys (camelCase). Validated (min **and** max). Writes **one** `SYSTEM_CONFIG_UPDATED` audit entry per call. |
| `SystemConfigService` | Loads all rows into memory on boot, refreshes on write. If a row is missing/garbage → logs a warning and uses the compiled-in default; the backend still boots even if the whole table is missing. |

**Four things now read from config instead of a hardcoded constant:**

| Setting | Consumed by |
|---|---|
| SLA approval hours | new requisition's SLA deadline · SLA-breach alert (wording + trigger) · 12-hour pending-approval nudge (fires at *half* this) |
| Default reorder level | low-stock "Low" pill + low-stock alert **for IES items that have no per-item reorder level set** |
| Useful-life years (per class) | replacement-requisition validation — a *serviceable* asset can only be replaced if it's older than its class threshold |
| Max failed login attempts | account lockout |

**Frontend — Master Admin → "System Settings":** the mock tabbed page (`SystemSettingsPage`)
is replaced with a real form for the 4 settings above — real load/save via `systemConfigApi`.
The old `/admin/config` page and its sidebar link were **deleted**. The aspirational tabs
(Numbering, Notifications, Forms & Print, Data Retention, Localization) and the "Reset frontend
demo state" control are gone; a muted line notes they are "not yet configurable".

**Frontend — Audit Trail:** the action-filter dropdown gains **"System Config Updated"**.

---

## 0. Setup

- [ ] **Migration** — `Database/schemas/006_system_config.sql` is **already applied to the
      dev Supabase** (done during the build). Only re-run it if you point at a different DB.
      It's `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING`, safe to re-run.
- [ ] **Backend** — `cd Backend && npm run start:dev`. Wait for `Nest application successfully started`.
      In the startup log you should NOT see any `system_config` error.
- [ ] **Frontend** — `cd Frontend && npm run dev`, open http://localhost:3000.
- [ ] **Reach the page** — log in as **System Admin** (`admin@cicc.gov.ph` / `Admin@CICC2026!`).
      You land on the Master Admin dashboard. Left nav → under **Platform** → **System Settings**
      (`/master-admin/configuration`).
- [ ] **The old page is gone** — `http://localhost:3000/admin/config` now 404s, and the old admin
      shell has no "System Config" sidebar link anymore.

**Admin-token helper** (PowerShell — used for the API/effect checks below):

```powershell
$t = (Invoke-RestMethod http://localhost:3001/api/v1/auth/login -Method Post -ContentType 'application/json' `
  -Body '{"emailOrEmployeeId":"admin@cicc.gov.ph","password":"Admin@CICC2026!"}').data.accessToken
$H = @{ Authorization = "Bearer $t" }
```

---

## A. The page loads real data

- [ ] Open **Master Admin → System Settings**. Briefly a loading skeleton, then the form.
- [ ] **Expect these four sections and values** (assuming nothing's been changed yet):

  | Section | Field | Value |
  |---|---|---|
  | Requisition SLA | Requisition Approval SLA (hours) | **24** |
  | Inventory Alerts | Default Low-Stock Reorder Level (units) | **10** |
  | Replacement — Useful-Life Threshold (years) | PPE / SEP / IES | **5 / 3 / 1** |
  | Security | Max Failed Login Attempts | **5** |

- [ ] The page is a single scrolling form (Requisition SLA / Inventory Alerts / Replacement /
      Security), **not** the old tabbed mock — no Numbering/Localization/… tabs, no "Reset frontend
      demo state" button, no "Settings saved to frontend mock state" toast.
- [ ] Cross-check the API directly: `Invoke-RestMethod http://localhost:3001/api/v1/system-config -Headers $H`
      → `data` matches what the page shows.

---

## B. Saving works and persists

- [ ] Change **Requisition Approval SLA (hours)** from `24` to `30`. Click **Save changes**.
- [ ] **Expect:** button shows "Saving…" briefly, then a green **"Configuration saved."** banner.
      (The old mock page just flashed a toast and saved nothing — this banner is real and stays
      until the next save/error.)
- [ ] **Reload the page (F5).** The SLA field still reads **30** — it persisted.
- [ ] `Invoke-RestMethod http://localhost:3001/api/v1/system-config -Headers $H` → `slaApprovalHours` is `30`.
- [ ] In Supabase: `select * from system_config where key = 'sla_approval_hours';` → `value` is `30`,
      `updated_by` is your admin user's id, `updated_at` is just now.
- [ ] Change **PPE** useful-life to `7` and **Max Failed Login Attempts** to `4` in the same save →
      green banner, both persist on reload.
- [ ] **Set everything back to defaults** (SLA 24, reorder 10, PPE/SEP/IES 5/3/1, max attempts 5)
      and Save. (Section F re-changes some of these; just leave a clean baseline here.)

---

## C. Validation (bad values are rejected)

- [ ] Set **Requisition Approval SLA (hours)** to `0` → Save.
      **Expect:** red error banner, text like *"slaApprovalHours must not be less than 1"*.
      Nothing persists (reload → still the last good value).
- [ ] Set SLA to `500` → Save. **Expect:** red banner *"…must not be greater than 168"*.
- [ ] Set **Default Low-Stock Reorder Level** to `-1` → Save → red banner *"…must not be less than 0"*.
- [ ] Set a **useful-life** field (PPE) to `0` → Save → red banner *"…must not be less than 1"*.
- [ ] Set **Max Failed Login Attempts** to `100` → Save → red banner *"…must not be greater than 50"*.
- [ ] Clear a field entirely and try to Save → the browser blocks it (field is `required`), no request sent.
- [ ] The number inputs also carry `min`/`max` — the browser's up/down spinners won't go past
      them (SLA 1–168, reorder 0–100000, useful-life 1–100, max attempts 1–50).

---

## D. Access control

- [ ] **No token:** `Invoke-RestMethod http://localhost:3001/api/v1/system-config` (no `-Headers`)
      → **401**.
- [ ] **Employee token:** log in as `employee@cicc.gov.ph` / `Employee@CICC2026!`, grab that
      token, `GET /api/v1/system-config` with it → **403**.
- [ ] Same employee token, `PATCH /api/v1/system-config -Body '{"slaApprovalHours":30}'` → **403**.
- [ ] (UI) While logged in as the **employee**, try `http://localhost:3000/master-admin/configuration`
      → you should be bounced / not see the form (the app guards non-admin routes).

---

## E. Audit trail

- [ ] Make a real change on **System Settings** (e.g. Max Failed Login Attempts 5 → 6 → Save).
- [ ] Open the audit trail: as **Management** (`management@cicc.gov.ph` / `Management@CICC2026!`)
      go to `/management/audit-trail`; or as System Admin open `http://localhost:3000/admin/audit-trail`
      by URL. (The Master Admin “Audit Log” page has a search box but no action dropdown.)
- [ ] **Expect:** a new row at the top — action **"System Config Updated"**, your name, just now.
- [ ] Open the **action filter** dropdown → it contains **"System Config Updated"**. Select it →
      the list filters to only config-change rows.
- [ ] In Supabase (or the row's detail): the entry's `metadata` has
      `changed: ["max_login_attempts"]` and `values: { max_login_attempts: 6 }` — **snake_case keys**.
- [ ] Change **two** fields in one Save (e.g. SLA 24→25 **and** PPE 5→6). Audit trail gets
      **exactly one** new row (not two), with `changed: ["sla_approval_hours","useful_life_years"]`.
- [ ] The same audit trail is also at **http://localhost:3000/management/audit-trail** (log in as
      `management@cicc.gov.ph` / `Management@CICC2026!`) — the "System Config Updated" filter option
      is there too.
- [ ] Reset SLA/PPE/attempts back to defaults (24 / 5 / 5) and Save.

---

## F. The settings actually take effect

This is the important part — proving each value is *read live*, not just stored.

### F1 · SLA approval hours → requisition SLA deadline + alert wording

- [ ] On **System Settings**, set **Requisition Approval SLA (hours)** to `10`. Save.
- [ ] As an **employee** (`employee@cicc.gov.ph`), submit any requisition. Note its request number.
- [ ] Check its deadline (admin token):
      ```powershell
      $r = Invoke-RestMethod "http://localhost:3001/api/v1/requisitions/mine" -Headers $H   # or query Supabase
      ```
      In Supabase: `select request_number, submitted_at, sla_deadline from requisitions order by created_at desc limit 1;`
- [ ] **Expect:** `sla_deadline` is `submitted_at` **+ 10 hours** (not +24).
- [ ] (Optional, ties it to the notification wording) In Supabase, age that requisition past the
      deadline: `update requisitions set submitted_at = now() - interval '48 hours', sla_deadline = now() - interval '24 hours', sla_breach_notified_at = null where request_number = '<REQ-…>';`
      then trigger the watchers:
      `Invoke-RestMethod http://localhost:3001/api/v1/notifications/run-checks -Method Post -Headers $H`
      → the SLA-breach notification message reads *"exceeded the **10**-hour approval SLA"* (not 24),
      and the pending-nudge (if in window) says *"over **5** hours"* (half of 10).
- [ ] Set SLA back to `24`. Save.

### F2 · Default reorder level → low-stock for items with no per-item level

- [ ] You need an **IES** supply asset **with no per-item reorder level**. Either use one that
      exists, or as **Property Custodian** (`property.custodian@cicc.gov.ph` / `PropertyCustodian@2026!`)
      register a new asset: Asset Class **IES**, Asset Type **Supplies**, **Quantity on Hand = 7**,
      leave **Reorder Level blank**.
- [ ] With the default reorder level at **10**: that item is **low** (7 ≤ 10). Confirm — Supply
      Inventory shows an amber **"Low"** pill on it; and
      `Invoke-RestMethod http://localhost:3001/api/v1/notifications/run-checks -Method Post -Headers $H`
      returns `lowStock ≥ 1`.
      *(If it was already flagged in a prior run, its dedup stamp may make `lowStock` come back 0 —
      that's fine, the pill is the tell.)*
- [ ] On **System Settings**, set **Default Low-Stock Reorder Level** to `5`. Save.
- [ ] Re-check that item: with quantity 7 and the default now **5**, it is **no longer low** (7 > 5).
      The amber "Low" pill is gone. A fresh `run-checks` does not re-flag it.
- [ ] Set the default back to `10`. Save → the item is low again.

### F3 · Useful-life years → replacement-requisition acceptance

- [ ] Pick an asset that is **serviceable** and assigned to the **employee** — e.g.
      `Dell Latitude 5540 Laptop` (`39d2aec9-b370-4293-9804-fb5a73f6c0e3`), acquired ~mid-2026,
      class **PPE**. Its Asset ID is on its detail page.
- [ ] With PPE useful-life at **5**: a ~3-month-old serviceable laptop is **within** its useful
      life. As the employee, submit a **Replacement** requisition, put that Asset ID in
      "Asset ID of the item being replaced".
      **Expect:** rejected — *"Replacement not justified: … serviceable and within its useful life
      (… **5**-year threshold for PPE)"*.
- [ ] To see acceptance actually flip, make the asset's age straddle the threshold. In Supabase:
      `update assets set acquisition_date = current_date - interval '2 years' where id = '39d2aec9-b370-4293-9804-fb5a73f6c0e3';`
- [ ] With PPE useful-life still **5**: submit the replacement → **rejected** (2 years < 5).
- [ ] On **System Settings**, set **PPE** useful-life to `1`. Save. Submit the replacement again →
      **accepted** (2 years ≥ 1). Check the audit entry for that requisition — its metadata has
      `replacementBasis: "useful_life"`.
- [ ] Restore: set PPE useful-life back to `5` on **System Settings**; put the asset's date back with
      `update assets set acquisition_date = '2026-05-31' where id = '39d2aec9-b370-4293-9804-fb5a73f6c0e3';`
      (or leave it — it's test data).

### F4 · Max failed login attempts → lockout

- [ ] On **System Settings**, set **Max Failed Login Attempts** to `3`. Save.
- [ ] Pick a **spare** account you don't mind locking — e.g. `management@cicc.gov.ph`. From the
      login page, enter its email with a **wrong** password **3 times**.
- [ ] **Expect:** on the 3rd failure the response is a lockout (message like *"Too many failed
      attempts. Account temporarily locked."* — 403), not just "Invalid credentials". With the old
      hardcoded value it would have taken 5.
- [ ] Unlock it so you don't lose the account: as System Admin,
      `PATCH /api/v1/users/<id>/unlock` (or `reset-password`), or wait out the lock window.
- [ ] Set **Max Failed Login Attempts** back to `5`. Save.

- [ ] **Final:** System Settings shows the clean defaults again — **24 / 10 / 5·3·1 / 5**.

---

## G. Resilience (optional)

- [ ] In Supabase: `update system_config set value = '"garbage"' where key = 'sla_approval_hours';`
- [ ] Restart the backend (`npm run start:dev`). **Expect:** it still boots. The startup/first-use
      log shows a warning like *`config "sla_approval_hours" = "garbage" is invalid; using default 24`*.
      `GET /api/v1/system-config` returns `slaApprovalHours: 24` (the compiled-in fallback).
- [ ] Fix it: `update system_config set value = '24' where key = 'sla_approval_hours';`
      (or PATCH via the page). No restart needed after a PATCH.
- [ ] (Heavier, optional) `alter table system_config rename to system_config_bak;` → restart backend →
      it **still starts** and every setting serves its default. Rename it back afterwards.

---

## H. Regression — what should NOT be there anymore

- [ ] The old `/admin/config` route is gone (404). The Master Admin "System Settings" page that
      replaced its mock is real — every Save hits `PATCH /api/v1/system-config`.
- [ ] No "PPE Minimum Acquisition Cost" / "Inventory Accuracy Target" fields on the page.
- [ ] If the initial load fails (e.g. stop the backend, then open System Settings): you get a red
      error banner **and a "Retry" button** — not an endless loading skeleton. Start the backend,
      click **Retry** → the form loads.

---

## Known limitations (expected — not bugs to chase here)

- **`SystemSettingsPage`’s other areas are still placeholders.** Only the 4 settings above are
  live; numbering formats, notification routing, forms & print, data retention, and localization
  are labelled "not yet configurable". `reference-data` (Master Data) is a separate mock.
- **Single backend instance only.** The config cache refreshes on write within one process; a
  second backend instance wouldn't see another's change until it restarts. Fine for the current
  single-instance deployment.
- **Deferred hardening** (tracked, not blocking): a malformed row logs a warning on *every* read
  rather than once; a multi-key PATCH isn't wrapped in a DB transaction, so a mid-write DB failure
  could in theory leave a partial change with no audit row (admin-only surface, needs a real DB
  blip).
- **Not runtime-configurable yet** (still constants / out of scope for this round): approval-route
  config, session/JWT policy, the ₱50,000 PPE cost threshold, numbering formats, data retention.

---

## When you're done

- If A–F check out, System Configuration works end to end in your environment.
- Anything that fails unexpectedly: write down exactly what you did and what happened.
- Delete this file once you're satisfied.
