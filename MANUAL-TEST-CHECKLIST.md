# AIMRS — Manual Test Checklist: Automated Notifications, SLA Enforcement & Supply Stock

Covers the `feature/notifications-auto-fire-sla-cron` branch. Go in order, tick things off,
write a one-line note next to anything that fails. Everything here already passes 220 unit +
21 end-to-end tests — this is about confirming it behaves in **your** environment against
**your** data, plus the UI.

---

## 0. One-time setup

- [ ] **Run the migration.** Supabase SQL editor → run `Database/schemas/004_supply_stock_and_notification_dedup.sql`.
      It's `ADD COLUMN IF NOT EXISTS`, safe to re-run.
- [ ] **Restart the backend** — `cd Backend && npm run start:dev`. Wait for `Nest application successfully started`.
      No `SchedulerModule` / `@nestjs/schedule` errors in the startup log.
- [ ] **Frontend** — `cd Frontend && npm run dev`, open http://localhost:3000.
- [ ] **Get a System Admin token** (needed for the manual trigger). Either:
  - Log in as `admin@cicc.gov.ph` / `Admin@CICC2026!`, DevTools → Network → any `/api/...` call → copy the `Authorization: Bearer …` header value; **or**
  - `curl -s -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"emailOrEmployeeId":"admin@cicc.gov.ph","password":"Admin@CICC2026!"}'` → copy `accessToken` from the JSON.

**The manual trigger** (drives all four watchers on demand so you don't wait for the hourly/daily cron):

```
POST http://localhost:3001/api/v1/notifications/run-checks
Authorization: Bearer <ADMIN_TOKEN>
→ 200  { "data": { "slaBreaches": N, "pendingNudges": N, "overdueReturns": N, "lowStock": N } }
```

A field of `-1` means that watcher threw — check the backend log.

---

## A. Access control on the trigger

- [ ] `POST /run-checks` with the **admin** token → `200` + the four-field summary object.
- [ ] Same call with an **employee** token (`employee@cicc.gov.ph` / `Employee@CICC2026!`) → `403`.
- [ ] Same call with **no** token → `401`.

---

## B. Supply stock model + low-stock alert

- [ ] Log in as **Property Custodian** (`property.custodian@cicc.gov.ph` / `PropertyCustodian@2026!`) → **Register New Asset**.
- [ ] Set **Asset Class = IES** → the **Quantity on Hand** and **Reorder Level** fields appear.
      Switch the class to PPE/SEP and back → the two fields **disappear** for non-IES.
- [ ] With IES selected: Quantity `3`, Reorder Level `5`, Asset Type `Supplies`, fill required fields, submit.
- [ ] **Supply Inventory** list → the new row shows a **Qty** column and an amber **"Low"** pill (3 ≤ 5).
- [ ] `POST /run-checks` → `lowStock` ≥ 1 in the response.
- [ ] Notifications as **Property Custodian** and as **System Admin** → each has a **Low Stock** alert (amber icon)
      naming the item, its quantity, and the threshold.
- [ ] **Dedup:** `POST /run-checks` again → `lowStock` is `0`, no new notification appears.
- [ ] **Re-arm (quantity):** open the asset → inline-edit **Quantity** to `20` → save → `POST /run-checks` → still `0`.
      Edit Quantity back to `2` → `POST /run-checks` → `lowStock` ≥ 1, a fresh notification.
- [ ] **Re-arm (reorder level only):** with quantity at `2`, edit **only Reorder Level** to `1` (2 > 1) → `POST /run-checks` → `0`.
      Edit Reorder Level back to `10` (2 ≤ 10) → `POST /run-checks` → `lowStock` ≥ 1 again.

---

## C. Overdue-return alert

- [ ] Log in as **IT Asset Custodian** (`itpersonnel@cicc.gov.ph` / `CiccIT@2026!Sec`) → open any `available` ICT asset →
      lifecycle action **Issue** → the issue form has a new **Expected return date** field. Issue it to an employee ID
      (e.g. `CICC-0042`) with any date.
- [ ] In Supabase, age it into the past:
      ```sql
      UPDATE assets
      SET expected_return_date = current_date - 5, overdue_notified_at = NULL
      WHERE id = '<asset-id>' AND status = 'issued';
      ```
- [ ] `POST /run-checks` → `overdueReturns` ≥ 1.
- [ ] Notifications: the **current holder** (the employee) **and every IT Personnel user** get an **Asset Return Overdue** alert (amber).
- [ ] **Dedup:** `POST /run-checks` again → `overdueReturns` is `0`.
- [ ] **Re-arm:** return the asset via lifecycle (**Return**). In Supabase confirm `expected_return_date` and
      `overdue_notified_at` are both `NULL`. Re-issue with a past date → `POST /run-checks` → alerts again.
- [ ] (Optional) Repeat with a **Fixed/Supplies** asset issued by Property Custodian → the role recipients should be
      **Property Custodian** users instead of IT Personnel.

---

## D. SLA breach + 12-hour pending nudge

- [ ] As **Employee**, submit a requisition (any). Note its request number; it lands `pending_supervisor`.
- [ ] **Breach path** — in Supabase:
      ```sql
      UPDATE requisitions
      SET submitted_at = now() - interval '48 hours',
          sla_deadline  = now() - interval '24 hours',
          sla_breach_notified_at = NULL, pending_nudge_notified_at = NULL
      WHERE request_number = '<REQ-…>';
      ```
- [ ] `POST /run-checks` → `slaBreaches` ≥ 1. An **SLA Breach** alert reaches: the **supervisor**, the **requester**,
      **every System Admin**, and **every Management** user.
- [ ] **Dedup:** `POST /run-checks` again → `slaBreaches` is `0`.
- [ ] **Nudge path** — reset and re-age to *between* 12h and 24h:
      ```sql
      UPDATE requisitions
      SET submitted_at = now() - interval '13 hours',
          sla_deadline  = now() + interval '11 hours',
          sla_breach_notified_at = NULL, pending_nudge_notified_at = NULL
      WHERE request_number = '<REQ-…>';
      ```
- [ ] `POST /run-checks` → `pendingNudges` ≥ 1 **and** `slaBreaches` is `0` (not breached yet).
- [ ] Only the **supervisor** gets the "approaching its 24-hour SLA" nudge. `POST /run-checks` again → `0` (dedup).

---

## E. Supply decrement on fulfillment

- [ ] As **Employee**, submit a **supply** requisition (Asset Class IES) for **quantity 2**. Approve it as the supervisor.
- [ ] As **Property Custodian** → Fulfillment queue → fulfill it, **linking the IES supply asset from section B**
      (make sure it has ≥ 2 on hand).
- [ ] Open that supply asset → **Quantity has dropped by 2**.
- [ ] Audit trail → the requisition's `REQUISITION_FULFILLED` entry → its metadata contains
      `stockDecrements: [{ assetId, from, to }]`.
- [ ] If that drop crossed the reorder level, a **Low Stock** alert fires **immediately** (not waiting for the cron).
- [ ] **Insufficient stock:** fulfill a request for more units than the supply has on hand →
      `400 "Insufficient stock: requested N, available M"`, and the requisition stays **unfulfilled** (nothing decremented).
- [ ] **Bad input:** a fulfill request with a non-UUID `assetId` → `400` (not a `500`).

---

## F. Frontend surfaces

- [ ] **Register form:** Quantity / Reorder Level appear only for IES (checked in B).
- [ ] **Asset detail:** for an IES asset, Quantity + Reorder Level show and are inline-editable; for an `issued` asset
      with an expected-return date set, that date is displayed.
- [ ] **Lifecycle Issue form:** the **Expected return date** input is present both on the asset detail page and in the
      custody workflow (`/it-asset-custodian/custody`, `/property-custodian/custody`).
- [ ] **Notifications inbox:** `sla_breach`, `low_stock`, `overdue_return` render with an **amber** warning icon;
      other alert types keep their blue/green/red icons.

---

## G. Cron schedule (optional — confirms the timer, not the logic)

- [ ] Temporarily change `@Cron(CronExpression.EVERY_HOUR)` and `@Cron(CronExpression.EVERY_DAY_AT_7AM)` in
      `Backend/src/scheduler/scheduler.service.ts` to `CronExpression.EVERY_30_SECONDS`, restart the backend, and watch
      the log for the `hourly: …` / `daily: …` lines firing on schedule.
- [ ] **Revert that change** before committing anything.

---

## Known limitations (expected — not bugs to chase here)

- **Before the first production run of `004`:** existing `IES` rows land at `quantity = 1` against the fallback
  threshold of 10, so the first sweep alerts every Property Custodian + System Admin once per supply line.
  Set real `quantity` / `reorder_level` on all `IES` rows first (also noted in the migration header).
- `ScheduleModule` runs per backend process — a multi-replica deployment would double-notify. Single instance today.
- A `docker-compose` dev database only auto-runs `001_initial_schema.sql`; run `002`/`003`/`004` by hand there.

---

## When you're done

- If A–F all check out, the feature works end to end in your environment.
- Anything that fails unexpectedly: write down exactly what you did and what happened.
- Delete this file once you're satisfied.
