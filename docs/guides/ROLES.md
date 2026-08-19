# AIMRS — Roles, Permissions & Test Credentials

> **System:** Asset Inventory Management and Requisition System (AIMRS)
> **Client:** Cybercrime Investigation and Coordinating Center (CICC)

---

## Test Login Credentials (Dev / Supabase Database)

| Role | Email | Password |
|---|---|---|
| System Administrator | admin@cicc.gov.ph | Admin@CICC2026! |
| IT Personnel | itpersonnel@cicc.gov.ph | CiccIT@2026!Sec |
| Supervisor | supervisor@cicc.gov.ph | Supervisor@CICC2026! |
| Employee | employee@cicc.gov.ph | Employee@CICC2026! |
| Management | management@cicc.gov.ph | Management@CICC2026! |
| Property Custodian | property.custodian@cicc.gov.ph | PropertyCustodian@CICC2026! |
| Property Officer | property.officer@cicc.gov.ph | PropertyOfficer@CICC2026! |

> **Note:** If an account gets locked after too many failed login attempts, a System Administrator can unlock it via `PATCH /api/v1/users/:id/unlock` or reset the password via `PATCH /api/v1/users/:id/reset-password`.

---

## Role Descriptions & Access

### Employee
**Dashboard:** `/employee/dashboard`

The service requester. Employees submit asset or supply requisitions and track their own requests through the approval process.

**Can do:**
- Log in and view their own dashboard
- Submit new requisitions (asset, supply, or replacement)
- View the status of their own requests (timeline view)
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
**Dashboard:** `/supervisor/dashboard`

The first-level approver. Supervisors review and act on requisitions submitted by employees in their section.

**Can do:**
- Log in and view the approvals queue dashboard
- View all pending requisitions assigned to them for approval
- Approve or reject requisitions (with comments)
- View the approval history log
- Submit their own requisitions (as a requester)
- Track the status of their own requests
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
**Dashboard:** `/it-personnel/dashboard`

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
- Receive notifications (low stock, overdue returns, SLA alerts)
- Submit their own requisitions

**Cannot do:**
- Approve or reject requisitions (that is Supervisor's role)
- Manage user accounts or assign roles
- View the full audit trail list (can only view per-asset transaction history)
- Configure system settings

---

### System Administrator
**Dashboard:** `/admin/dashboard`

Full system access. Manages user accounts, roles, and system configuration. Also has access to the audit trail and can generate reports.

**Can do:**
- Log in and view the system health / admin dashboard
- Create new user accounts
- Deactivate user accounts (no deletion — preserves audit trail)
- Assign or change user roles
- Reset user passwords (`PATCH /api/v1/users/:id/reset-password`)
- Unlock locked accounts (`PATCH /api/v1/users/:id/unlock`)
- View the full immutable audit trail (all system actions, filterable and exportable)
- Approve or reject requisitions
- View all inventory dashboards
- Generate reports and official COA forms
- Configure system settings (thresholds, SLA targets, approval routes)
- Receive all system notifications

**Cannot do:**
- Delete audit log entries (audit logs are append-only by design — COA compliance)
- Delete user accounts (deactivation only)

---

### Management
**Dashboard:** `/management/dashboard`

Read-only oversight role. Management accesses dashboards and reports for monitoring and audit-readiness but cannot perform any operational actions.

**Can do:**
- Log in and view the executive KPI dashboard
  - Inventory accuracy percentage
  - Average requisition approval time
  - SLA compliance rate
  - Total assets and requisitions
- View the full audit trail (read-only)
- Generate and download management reports
- Receive system notifications

**Cannot do:**
- Submit, approve, or fulfill any requisition
- Register or update any asset
- Manage users or roles
- Generate official COA forms
- Modify any system data or configuration

---

## Quick Reference — Feature Access Matrix

| Feature | Employee | Supervisor | IT Personnel | System Admin | Management |
|---|:---:|:---:|:---:|:---:|:---:|
| Login | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit requisition | ✓ | ✓ | ✓ | — | — |
| Track own requests | ✓ | ✓ | ✓ | — | — |
| Browse asset catalogue | ✓ | ✓ | ✓ | — | — |
| Approve / reject requisitions | — | ✓ | — | ✓ | — |
| View approval history | — | ✓ | ✓ | ✓ | ✓ |
| Register new assets | — | — | ✓ | — | — |
| Edit asset details (non-status fields) | — | — | ✓ | — | — |
| Update asset lifecycle | — | — | ✓ | — | — |
| Generate QR / barcodes | — | — | ✓ | — | — |
| Scan QR / barcodes | — | — | ✓ | — | — |
| Issue / return / transfer assets | — | — | ✓ | — | — |
| Flag assets for repair / disposal | — | — | ✓ | — | — |
| View asset transaction history | — | — | ✓ | ✓ | ✓ |
| Generate official COA forms | — | — | ✓ | ✓ | — |
| View full inventory dashboard | — | — | ✓ | ✓ | ✓ |
| User account management | — | — | — | ✓ | — |
| Role assignment | — | — | — | ✓ | — |
| View full audit trail (all records) | — | — | — | ✓ | ✓ |
| System configuration | — | — | — | ✓ | — |
| Generate management reports | — | — | ✓ | ✓ | ✓ |
| Receive notifications | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Page Routes Per Role

| Role | Pages |
|---|---|
| **Employee** | `/login`, `/employee/dashboard`, `/employee/requisitions/new`, `/employee/requisitions`, `/employee/requisitions/[id]`, `/employee/catalogue`, `/employee/notifications` |
| **Supervisor** | `/login`, `/supervisor/dashboard`, `/supervisor/approvals`, `/supervisor/approvals/[id]`, `/supervisor/history`, `/supervisor/notifications` |
| **IT Personnel** | `/login`, `/it-personnel/dashboard`, `/it-personnel/assets`, `/it-personnel/assets/new`, `/it-personnel/assets/[id]`, `/it-personnel/qr-scan`, `/it-personnel/requisitions`, `/it-personnel/forms`, `/it-personnel/reports`, `/it-personnel/notifications` |
| **System Admin** | `/login`, `/admin/dashboard`, `/admin/users`, `/admin/users/[id]/role`, `/admin/audit-trail`, `/admin/config`, `/admin/notifications` |
| **Management** | `/login`, `/management/dashboard`, `/management/reports`, `/management/audit-trail` |
