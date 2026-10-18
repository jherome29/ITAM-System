# AIMRS — Roles, Permissions & Test Credentials

> **System:** Asset Inventory Management and Requisition System (AIMRS)
> **Client:** Cybercrime Investigation and Coordinating Center (CICC)
> **Last reviewed against the controllers:** 2026-10-16. Six roles (the Property Officer was merged into the Property Custodian on 2026-10-16). The permission matrix below is read from each controller's `@Roles(...)` list and is the same table as CLAUDE.md §4: change both together.

---

## Test Login Credentials (Dev / Supabase Database)

| Role | Email | Password |
|---|---|---|
| System Administrator | admin@cicc.gov.ph | Admin@CICC2026! |
| IT Personnel | itpersonnel@cicc.gov.ph | CiccIT@2026!Sec |
| Supervisor | supervisor@cicc.gov.ph | Supervisor@CICC2026! |
| Employee | employee@cicc.gov.ph | Employee@CICC2026! |
| Management | management@cicc.gov.ph | Management@CICC2026! |
| Property Custodian | property.custodian@cicc.gov.ph | PropertyCustodian@2026! |
| Property Custodian (second account; was the Property Officer, `property.officer@cicc.gov.ph` until 2026-10-16) | property.custodian2@cicc.gov.ph | PropertyOfficer@2026! |
| Supervisor (Approving Officer, Property and Supply Management) | psm.approver@cicc.gov.ph | PSMApprover@2026! |
| Employee (UAT demo account 1) | uat.employee1@cicc.gov.ph | Employee1@CICC2026! |
| Employee (UAT demo account 2) | uat.employee2@cicc.gov.ph | Employee2@CICC2026! |
| Employee (UAT demo account 3) | uat.employee3@cicc.gov.ph | Employee3@CICC2026! |
| Employee (UAT demo account 4) | uat.employee4@cicc.gov.ph | Employee4@CICC2026! |
| Employee (UAT demo account 5) | uat.employee5@cicc.gov.ph | Employee5@CICC2026! |

> **UAT demo accounts (2026-10-17):** the five `uat.employee1`-`5` rows are Employee accounts created for the officers' testing on the Railway site (employee IDs `UAT-EMP-001` to `005`, Operations / Field Operations). Simple passwords in the same style as the others (`EmployeeN@CICC2026!`), demo accounts only: reset or delete them before any real deployment (Master Admin > Users).

> **The last row is the approver for the Property Custodian.** The role sits in the *Property and Supply Management* division (section *Property Custody Unit*; the retired Property Officer's section was *Property Governance*); requisitions route to the active Approving Officer of the requester's section, then their division, so this account (employee ID `CICC-SUP-002`, section *Property and Supply Approving Office*) receives theirs. Its own requisitions go to its alternate approver, `alt.supervisor@cicc.gov.ph` (`CICC-ALT01`). Created 2026-10-16 through `POST /api/v1/users` and verified with a live login. The `supervisor@cicc.gov.ph` account (Maria Santos, *Operations / Field Operations*) is unchanged and approves for that section only.

> **Note:** If an account gets locked after too many failed login attempts, a System Administrator can unlock it via `PATCH /api/v1/users/:id/unlock` or reset the password via `PATCH /api/v1/users/:id/reset-password`. To end a possibly-compromised session without changing the password, use `PATCH /api/v1/users/:id/revoke-sessions`.
>
> The 2 Property role passwords above were reset 2026-08-21 via the real `PATCH /api/v1/users/:id/reset-password` endpoint and verified with a live login (both accounts existed with no known-working password before this). If you find these no longer work, someone has reset them again since — check with the team rather than assuming this doc is wrong.

---

## Role Descriptions & Access

### Employee
**Dashboard:** `/employee/dashboard`

The service requester. Employees submit asset or supply requisitions and track their own requests through the approval process.

**Can do:**
- Log in and view their own dashboard
- Submit new requisitions (new item or supply; the type is derived from the item, never picked by hand)
- Ask for a **replacement** of an asset they hold once it qualifies (My Assigned Assets → Request replacement)
- See the assets they hold (**My Assigned Assets**) and file a **return, repair, damage, loss or theft** request for one (**Returns & Incidents**, with up to 3 photo/PDF attachments)
- View the status of their own requests (timeline view) and download the documents generated for them
- Browse the asset catalogue
- Receive notifications about their requests

**Cannot do:**
- Approve or reject any requisition
- View other users' requests
- Register, update, or manage assets
- Access inventory dashboards
- Generate reports or official forms
- View the audit trail
- Manage user accounts

---

### Supervisor
**Dashboard:** `/approving-officer/dashboard`

The first-level approver. Supervisors review and act on requisitions submitted by employees in their section.

**Can do:**
- Log in and view the approvals queue dashboard
- View all pending requisitions assigned to them for approval
- Approve or reject requisitions (with comments)
- View the approval history log
- Submit their own requisitions (as a requester); these go to their designated alternate approver
- Mark themselves unavailable (with an optional end date) and designate an alternate approver
- Track the status of their own requests, and see/file requests for assets they hold
- Browse the asset catalogue
- Receive notifications (pending approvals, SLA breach alerts)

**Cannot do:**
- Register, update, or manage assets
- Fulfill requisitions (that is IT Personnel's role)
- Generate official COA forms or reports
- View the full inventory dashboard
- View the audit trail
- Manage user accounts

---

### IT Personnel
**Dashboard:** `/it-asset-custodian/dashboard`

The asset custodian and primary operational role. IT Personnel manages the entire asset registry, handles requisition fulfillment, and generates all official COA forms.

**Can do:**
- Log in and view the full inventory overview dashboard
- Register new assets (add to inventory)
- View full asset details and transaction history (per-asset audit trail)
- Edit asset details (description, brand, serial number, property number, acquisition info, location, condition — not status or classification)
- Update asset lifecycle status via inline modal:
  - Issue an asset to an employee (by employee ID, e.g. CICC-0042)
  - Mark an asset as returned
  - Transfer an asset to another office/section
  - Flag an asset for repair
  - Flag an asset for disposal (documentation only; justification required)
- Generate and print QR codes / barcodes for assets
- Scan QR codes / barcodes to look up assets
- View and fulfill approved requisitions from the fulfillment queue
- Generate all 18 official COA/CICC forms:
  - PAR (Property Acknowledgment Receipt)
  - ICS (Inventory Custodian Slip)
  - PTR (Property Transfer Report)
  - IIRUP (Inventory and Inspection Report of Unserviceable Property)
  - RLSDDP (Report of Lost, Stolen, Damaged or Destroyed Property)
  - Sticker Card / Asset Label
  - Receipt of Returned Property/Equipment
  - Receipt of Returned Semi-Expendable Property
  - IAR (Inspection and Acceptance Report)
  - Move-In Form
  - Move-Out Form
  - RIS (Requisition and Issue Slip)
  - RSMI (Report of Supplies and Materials Issued)
  - RSPI (Report of Semi-Expendable Property Issued)
  - RPCI (Report on Physical Count of Inventories)
  - RPCPPE (Report on Physical Count of PPE)
  - WMR (Waste Materials Report)
  - Annex A.4 (Registry of Semi-Expendable Property Issued)
- Re-download previously generated forms from the database
- Generate management reports (Asset Master List, Issuance Records, etc.)
- Decide return / repair / damage / loss / theft requests for ICT assets (approve, reject with a reason of 10+ characters, mark received); completing one drives the lifecycle and generates its COA documents
- Run the Maintenance & Repair queue: repair records, loaner units, outcome repaired / not repairable
- Recommend disposal with a documented justification (documentation only; the actual disposal is a manual COA process)
- Receive notifications (low stock, overdue returns, overdue repairs, SLA alerts)
- Submit their own requisitions (another IT custodian, or the System Administrator, fulfils those)
- **Only ICT assets**: any other asset type is out of scope for every read and write

**Cannot do:**
- Fulfil, hold or decide anything they filed themselves
- Approve or reject requisitions (that is Supervisor's role)
- Manage user accounts or assign roles
- View the full audit trail list (can only view per-asset transaction history)
- Configure system settings

---

### System Administrator
**Dashboard:** `/master-admin/dashboard`

Full system access. Manages user accounts, roles, and system configuration. Also has access to the audit trail and can generate reports.

**Can do:**
- Log in and view the system health / admin dashboard
- Create new user accounts
- Deactivate user accounts (no deletion — preserves audit trail)
- Reactivate a deactivated account (`PATCH /api/v1/users/:id/activate` — also clears the lockout)
- Assign or change user roles
- Reset user passwords (`PATCH /api/v1/users/:id/reset-password`)
- Unlock locked accounts (`PATCH /api/v1/users/:id/unlock`) — the directory flags a **Locked** status and shows the action only while a lockout is live
- Force-sign-out a user — revoke every active session without changing their password (`PATCH /api/v1/users/:id/revoke-sessions`)
- Filter the user directory by role; open an account to see its recent activity (`GET /api/v1/audit/user/:userId`)
- View the full immutable audit trail (all system actions; filter by action type and by date range; exportable)
- Approve or reject requisitions
- Fulfil or hold a requisition **filed by a custodian** (Master Admin → Requisition Fulfilment, `GET /api/v1/requisitions/fulfilment-fallback`) — a custodian may not fulfil their own, and this is the fallback when no other custodian can
- View all inventory dashboards
- Generate reports and official COA forms
- Configure system settings (thresholds, SLA targets, approval routes)
- Receive all system notifications

**Cannot do:**
- File a requisition (403), or register / edit assets: the System Administrator has no operational asset role
- Fulfil or hold any requisition filed by someone other than a custodian
- Delete audit log entries (audit logs are append-only by design — COA compliance)
- Delete user accounts (deactivation only)

---

### Management
**Dashboard:** `/management-audit/dashboard`

Read-only oversight role. Management accesses dashboards and reports for monitoring and audit-readiness but cannot perform any operational actions.

**Can do:**
- Log in and view the executive KPI dashboard
  - Inventory accuracy percentage
  - Average requisition approval time
  - SLA compliance rate
  - Total assets and requisitions
- View the full audit trail (read-only)
- Generate and download management reports, and the Audit Trail Report (PDF / Excel)
- View the forms archive and the read-only Returns & Incidents / repair lists
- Receive system notifications

**Cannot do:**
- Submit, approve, or fulfill any requisition
- Register or update any asset
- Manage users or roles
- Generate official COA forms
- Modify any system data or configuration

---

### Property Custodian
**Dashboard:** `/property-custodian/dashboard`

The custodian of **Fixed assets and Supplies** (furniture, vehicles, office equipment, consumables). Everything IT Personnel do for ICT, for these two asset types.

**Can do:**
- Register Fixed assets and Supplies; for a supply, set its quantity and reorder level (a low-stock alert fires when it drops below)
- Edit non-status fields, update the lifecycle (issue, return, transfer, repair, flag for disposal, restore a flagged asset), generate and scan QR codes
- Fulfil or hold approved Fixed / Supplies requisitions (fulfilling a supply draws the stock down in the same transaction)
- Decide Returns & Incidents requests for Fixed / Supplies, and run the Maintenance & Repair queue (including loaner units)
- See the Physical Inventory count sheet, and recommend disposal with a documented justification
- **Replacement Validation** and **Disposal Review**, two read-only lists: every replacement request with the basis it was justified on and the old unit's repairs in the last 12 months (plus held items that already qualify but have no open request), and every asset recommended for disposal. They were the Property Officer's screens
- Generate official COA forms and view the forms archive; receive notifications (low stock, overdue returns, repairs)
- **File requisitions and replacements** (My Requisitions, Request replacement) like any other holder, and see **My Assigned Assets**

**Cannot do:**
- Touch ICT assets (403), or fulfil, hold or decide anything they filed themselves: another Property Custodian, or the System Administrator, does
- Approve requisitions, manage users or roles, configure the system, view the full audit trail

---

> The Property Custodian files requisitions like any employee: the request routes to the active Approving Officer of their section, otherwise their division (here, `psm.approver@cicc.gov.ph`, whose own requests go to its alternate). If the division has none, submitting fails with "No supervisor is configured for your section".

---

## Who Files, Approves and Fulfils a Requisition

| Requester | Routes to (approver) | Fulfilled by |
|---|---|---|
| Employee | Approving Officer of their section, else their division | IT Personnel (ICT items) / Property Custodian (Fixed assets, Supplies) |
| Supervisor (Approving Officer) | Their designated alternate approver | Same custodian split |
| IT Personnel | Approving Officer of their section, else division | **Another** IT Personnel; the System Administrator if the request is theirs and there is no other |
| Property Custodian | Approving Officer of their section, else division | **Another** Property Custodian; the System Administrator as fallback |
| Management, System Administrator | — cannot file — | — |

---

## Quick Reference — Feature Access Matrix

| Feature | Employee | Supervisor | IT Personnel | Property Custodian | System Admin | Management |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Login | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit requisition / replacement | ✓ | ✓ | ✓ | ✓ | — | — |
| Track own requests | ✓ | ✓ | ✓ | ✓ | — | — |
| Browse the asset catalogue (requisition picker) | ✓ | ✓ | ✓ | ✓ | — | — |
| See assets I hold; file return / repair / damage / loss / theft on them | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Receive notifications | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Print a numbered paper copy of a record I can see (requisition, return / incident request, repair) | ✓ ⁴ | ✓ ⁴ | ✓ ³ | ✓ ³ | ✓ | ✓ |
| Approve / reject requisitions | — | ✓ | — | — | ✓ | — |
| Approval history (decisions I made) | — | ✓ | — | — | ✓ | — |
| Fulfil / hold requisitions | — | — | ✓ ¹ | ✓ ¹ | ✓ ² | — |
| Decide returns & incidents requests | — | — | ✓ ¹ | ✓ ¹ | ✓ ² | — |
| Run maintenance & repair (incl. loaner) | — | — | ✓ ¹ | ✓ ¹ | ✓ ² | — |
| Register assets, edit non-status fields | — | — | ✓ ³ | ✓ ³ | — | — |
| Update asset lifecycle (issue / return / transfer / repair / flag for disposal) | — | — | ✓ ³ | ✓ ³ | — | — |
| Generate / scan QR and barcodes | — | — | ✓ ³ | ✓ ³ | — | — |
| View the asset registry and inventory dashboard | — | — | ✓ ³ | ✓ ³ | ✓ | ✓ |
| View an asset's transaction history | — | — | ✓ ³ | ✓ ³ | ✓ | ✓ |
| See the replacement-validation list and assets flagged for disposal (read-only) | — | — | ✓ ³ | ✓ ³ | ✓ | ✓ |
| Generate official forms (PAR, ICS, RIS…) | — | — | ✓ | ✓ | ✓ | — |
| View / download the forms archive (COA forms; paper-copy printouts are read through their own record, never from here) | — | — | ✓ | ✓ | ✓ | ✓ |
| Generate management reports | — | — | ✓ | ✓ | ✓ | ✓ |
| User accounts, role assignment, system configuration | — | — | — | — | ✓ | — |
| View the full audit trail (all records) | — | — | — | — | ✓ | ✓ |
| Executive KPI dashboard | — | — | — | — | ✓ | ✓ |

¹ Never for a requisition or request they filed themselves. ² Only for a custodian's own request or requisition (the fallback). ³ Inside the role's own asset-type scope: IT Personnel see and change **ICT** only; Property Custodian sees **Fixed** and **Supplies** only. Enforced in the service layer on every read and write (`resolveAssetTypeScope`), not just in the menu. ⁴ Only a record they can already read: their own requisition or request, a requisition routed to them, or a repair of an item they hold (a repair's holder may print it although the repair queue is the custodians'). Each print is numbered `PR-YYYY-NNNN`, stored and audited; a later one is marked REPRINT.

---

## Page Routes Per Role

| Role | Pages |
|---|---|
| **Employee** | `/login`, `/employee/{dashboard, catalogue, requisitions, requisitions/new, requisitions/[id], assigned-assets, returns-incidents, notifications}` |
| **Supervisor** (Approving Officer) | `/login`, `/approving-officer/{dashboard, approvals, approval-history, requisitions, assigned-assets, notifications}` |
| **IT Personnel** (IT Asset Custodian) | `/login`, `/it-asset-custodian/{dashboard, assets, assets/new, assets/[id], fulfillment, custody, returns-incidents, qr-scanner, maintenance, physical-inventory, disposal, reports, management-reports, requisitions, assigned-assets, notifications}` |
| **System Admin** (Master Administrator) | `/login`, `/master-admin/{dashboard, users, roles, configuration, audit, returns-incidents, repairs, fulfillment, assigned-assets, notifications}` |
| **Management** (Management & Audit Viewer) | `/login`, `/management-audit/{dashboard, asset-reports, requisition-reports, maintenance-disposal, physical-count, audit, forms, assigned-assets, notifications}` |
| **Property Custodian** | `/login`, `/property-custodian/{dashboard, fixed-assets, supplies, fulfillment, custody, returns-incidents, maintenance, qr-scanner, physical-inventory, disposal, disposal-review, replacements, reports, requisitions, assigned-assets, notifications}` |

Every role also has **My Assigned Assets** and **Notifications**. The menu for each role is `Frontend/lib/roles/role-navigation.ts`; an address with no screen behind it is a 404.

---

## The retired Property Officer role

The Property Officer could see the registry, replacement validation, disposal review and the forms archive and file requisitions, and could change nothing. The Property Custodian can do all of that and more, so the two were merged on 2026-10-16. What happened:

- Accounts that held the role became Property Custodians (schema `017`; their sessions were invalidated so the next login shows the new menu). In the shared dev database that was one account (`property.officer@cicc.gov.ph`, Carmela Bautista, `CICC-PO-001`), migrated on 2026-10-16 and renamed `property.custodian2@cicc.gov.ph` the same day, with its section moved from *Property Governance* to *Property Custody Unit*. It keeps its password and its employee ID (an ID is permanent and cannot be edited through the app); it lands on the Property Custodian dashboard.
- The `property_officer` value stays in the Postgres `user_role` enum and in the shared `UserRole` enum, marked deprecated: Postgres cannot drop an enum value, and old audit entries still carry it. No route grants it, the API refuses to assign it (`ASSIGNABLE_USER_ROLES`), and the admin dashboard lists it only while an account still holds it.
- The two Property Officer screens that read real records, **Replacement Validation** and **Disposal Review**, are now in the Property Custodian's menu; the consolidated registry and dashboard were dropped (the custodian has the Fixed Assets and Supplies registries). `/property-officer/*` redirects.
- Trade-off accepted: a custodian both recommends a disposal and can review it. That is harmless while the review is read-only, but it means the role cannot later become an independent approval gate without being re-added.
