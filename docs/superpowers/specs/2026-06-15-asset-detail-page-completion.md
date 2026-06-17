# Design Spec: Asset Detail Page Completion
**Date:** 2026-06-15
**Page:** `/it-personnel/assets/[id]`
**File:** `Frontend/app/it-personnel/assets/[id]/page.tsx`

---

## What Already Exists

The page is scaffolded and functional at a basic level:

- 4 detail sections in a 2×2 grid (Classification, Accountability, Acquisition, System)
- Lifecycle modal with status dropdown + generic notes field
- Generate QR button
- Back button, loading skeleton, error state

No backend changes are required — all necessary endpoints already exist.

---

## What Is Missing (Scope of This Task)

### 0. Edit Asset Details
An "Edit" button in the page header toggles the 4 detail sections into an editable form. All fields become inputs. Save/Cancel buttons appear. On save, calls `PATCH /api/v1/assets/:id`. On cancel or successful save, returns to read view.

This requires:
- **Backend:** New `PATCH /api/v1/assets/:id` endpoint (IT Personnel only) + `UpdateAssetDto` (all asset fields optional) + `update()` method in `AssetsService`
- **Frontend:** `edit` boolean state; detail sections conditionally render inputs or text; `assetsApi.update(id, dto)` call

Fields editable: `itemDescription`, `brand`, `serialNumber`, `propertyNumber`, `sapClassification`, `itemCode`, `components`, `acquisitionCost`, `acquisitionDate`, `supplier`, `dateOfDelivery`, `accountableOfficer`, `division`, `officeOrSection`, `officeLocation`, `condition`

Fields NOT editable via this form: `status` (lifecycle only), `assetClass`, `assetType`, `qrCode`, `barcodeValue`, `id`, `createdAt`, `updatedAt`, `custodianId`

The save action must write an audit log entry (`ASSET_UPDATED`).

### 1. Transaction History Panel
A full-width panel below the detail grid showing the asset's lifecycle history. Sourced from `GET /api/v1/audit/record/:assetId` (existing endpoint, currently restricted to Admin/Management — see note below).

**Columns:** Date/Time · Action · Performed By (user ID — display as truncated ID since we have no user lookup here) · Notes

**Note on audit endpoint access:** `GET /api/v1/audit/record/:recordId` is currently guarded to `SYSTEM_ADMIN` and `MANAGEMENT` only. IT Personnel needs read access to audit history for assets they manage. The backend guard must be updated to also allow `IT_PERSONNEL` for this endpoint.

### 2. Context-Aware Lifecycle Modal Fields

The current modal shows a generic dropdown + notes for all transitions. It needs to show different fields depending on the selected target status:

| Target Status | Extra Fields Required |
|---|---|
| `ISSUED` | Employee ID text input (the recipient's employee ID, e.g. `CICC-0042`) — backend resolves to UUID |
| `TRANSFERRED` | To Location input (text — office/section receiving the asset) — maps to `toLocation` in DTO |
| `FLAGGED_FOR_DISPOSAL` | Notes field becomes **required** (justification is mandatory for disposal) |
| `UNDER_REPAIR` | Notes field (optional — describe the issue) |
| All others | Notes field (optional) |

**Custodian lookup note:** IT Personnel do not have access to `GET /api/v1/users` (Admin/Management only), so they cannot search for a user UUID. Instead, the ISSUED transition shows a plain text input for the recipient's **Employee ID** (e.g. `CICC-0042`). The backend `AssetsService.updateLifecycle()` must be updated to accept `employeeId` (string) in addition to `custodianId` (UUID) and resolve it via the `UsersService`. This is a small backend addition but avoids forcing IT Personnel to know raw UUIDs.

The frontend `UpdateLifecycleDto` in `lib/api/assets.ts` needs `employeeId` (string) and `toLocation` added.

### 3. Post-Transition Form Suggestion

After a successful lifecycle update, show a dismissible prompt suggesting the relevant COA form:

| Transition | Suggested Form |
|---|---|
| → ISSUED (asset class PPE) | Generate PAR |
| → ISSUED (asset class SEP) | Generate ICS |
| → TRANSFERRED | Generate PTR |
| → FLAGGED_FOR_DISPOSAL | Generate IIRUP |

The prompt is a banner with two buttons: "Generate Form" (links to `/it-personnel/forms` with the form type pre-selected via query param) and "Dismiss".

### 4. Custodian Display

The current page shows the raw `custodianId` UUID in the System section. Since the asset API doesn't return custodian details, replace the System section's custodian row with a truncated UUID display (`...last-8-chars`) or simply relabel it "Custodian ID" with `font-mono` styling. No extra API call needed.

---

## Layout (Final)

**Read mode (default):**
```
[Back button]
[Asset title + StatusBadge]   [Edit] [Generate QR] [Update Lifecycle]
[QR code strip — if qrCode exists]
[post-transition form suggestion banner — if just updated]

[Classification card]   [Accountability card]
[Acquisition card]      [System card]

─────────────────────────────────────────────
[Transaction History — full width]
  Columns: Date/Time | Action | Performed By | Notes
  Empty state: "No lifecycle history recorded yet."
```

**Edit mode (after clicking Edit):**
```
[Back button]
[Asset title + StatusBadge]   [Save Changes] [Cancel]

[Classification card — inputs]   [Accountability card — inputs]
[Acquisition card — inputs]      [System card — read only]

─────────────────────────────────────────────
[Transaction History — unchanged, still visible]
```

System card is read-only in edit mode (ID, barcode, timestamps are system-managed).

---

## Backend Changes Required

### A. Audit endpoint — add IT_PERSONNEL access
**File:** `Backend/src/audit/audit.controller.ts`
```typescript
// Before:
@Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
// After:
@Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT, UserRole.IT_PERSONNEL)
```
Only on the `GET record/:recordId` route — not the full audit list.

### B. New update endpoint
**New file:** `Backend/src/assets/dto/update-asset.dto.ts` — all fields from `CreateAssetDto` but all `@IsOptional()`

**`Backend/src/assets/assets.service.ts`** — add `update(id, dto, performedById)`:
- Load asset via `findOneOrFail`
- `this.assetRepo.update(id, dto)`
- Write `ASSET_UPDATED` audit log
- Return updated asset

**`Backend/src/assets/assets.controller.ts`** — add:
```typescript
@Patch(':id')
@Roles(UserRole.IT_PERSONNEL)
async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto, @Req() req)
```

### C. Lifecycle — accept employeeId for ISSUED transition
**`Backend/src/assets/dto/update-lifecycle.dto.ts`** — add `@IsOptional() @IsString() employeeId?: string`

**`Backend/src/assets/assets.service.ts` `updateLifecycle()`** — if `dto.employeeId` is provided and status is `ISSUED`, resolve to UUID via `UsersService.findByEmployeeId(dto.employeeId)` and use that as `custodianId`.

---

## Frontend Changes Required

1. **`Frontend/lib/api/assets.ts`**
   - Add `employeeId` and `toLocation` to `UpdateLifecycleDto` interface
   - Add `UpdateAssetDto` interface (all fields optional)
   - Add `assetsApi.update(id, dto)` → `PATCH /v1/assets/:id`

2. **`Frontend/lib/api/audit.ts`** — Already typed correctly; no change needed

3. **`Frontend/app/it-personnel/assets/[id]/page.tsx`** — The main file:
   - Add `edit` boolean state; "Edit" button in header toggles it
   - In edit mode: detail sections render `<input>` / `<select>` fields instead of `<dd>` text
   - Save button calls `assetsApi.update()`, Cancel resets form state
   - Add `transactions` state + `useEffect` to call `auditApi.byRecord(id)` on mount (parallel with asset fetch)
   - Replace single-state lifecycle modal with context-aware version (Employee ID field for ISSUED, To Location for TRANSFERRED, required notes for disposal)
   - Add `formSuggestion` state set after successful lifecycle update
   - Add post-transition form suggestion banner
   - Add Transaction History panel below the detail grid
   - Fix custodian display (relabel as "Custodian ID", mono font)

---

## Data Flow

```
Page mounts
  → assetsApi.getOne(id)         → populate detail sections + initialize edit form state
  → auditApi.byRecord(id)        → populate history table (parallel)

IT Personnel clicks "Edit"
  → edit mode enabled; detail cards show inputs pre-filled with current values
  → clicks "Save": assetsApi.update(id, changedFields)
    → on success: update asset state, exit edit mode, re-fetch audit history
    → on error: show inline error, stay in edit mode
  → clicks "Cancel": reset form state, exit edit mode

IT Personnel clicks "Update Lifecycle"
  → modal opens with context-aware fields based on selected target status
  → on submit: assetsApi.updateLifecycle(id, { status, employeeId?, toLocation?, notes? })
  → on success: update asset state + re-fetch audit history + set formSuggestion state

IT Personnel clicks "Generate Form" in suggestion banner
  → router.push('/it-personnel/forms') (user selects form type on forms page)
```

---

## Out of Scope

- Resolving custodian UUID to a full name (no user lookup API accessible to IT Personnel)
- Inline form generation on this page (forms page handles this)
- User search/dropdown for ISSUED recipient (employee ID text input is sufficient)
- Pre-selecting form type on the forms page via query param (separate task)
