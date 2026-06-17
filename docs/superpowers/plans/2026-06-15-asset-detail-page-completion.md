# Asset Detail Page Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete `/it-personnel/assets/[id]` with edit mode, context-aware lifecycle modal, transaction history panel, and post-transition form suggestion banner.

**Architecture:** Three backend changes (audit role guard, new update endpoint, employeeId resolution in lifecycle) then three frontend changes (API client, edit mode, history + modal + banner). Each task is independently testable. Backend first so the frontend has real endpoints to call.

**Tech Stack:** NestJS (TypeScript), TypeORM, Jest — Backend. Next.js 15 App Router, React, Tailwind CSS, axios — Frontend.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `Backend/src/audit/audit.controller.ts` | Modify | Add `IT_PERSONNEL` to `byRecord` route roles |
| `Backend/src/assets/dto/update-asset.dto.ts` | **Create** | All editable asset fields, all optional |
| `Backend/src/assets/assets.service.ts` | Modify | Add `update()` method; add `employeeId` resolution in `updateLifecycle()` |
| `Backend/src/assets/assets.controller.ts` | Modify | Add `PATCH :id` endpoint |
| `Backend/src/assets/assets.module.ts` | Modify | Import `UsersModule` for employee ID lookup |
| `Backend/src/assets/dto/update-lifecycle.dto.ts` | Modify | Add `employeeId?: string` field |
| `Backend/src/assets/assets.service.spec.ts` | Modify | Add tests for `update()` and `employeeId` resolution |
| `Frontend/lib/api/assets.ts` | Modify | Add `UpdateAssetDto` interface, `employeeId`/`toLocation` to lifecycle DTO, `update()` method |
| `Frontend/app/it-personnel/assets/[id]/page.tsx` | Modify | Edit mode, context-aware modal, history panel, suggestion banner |

---

## Task 1: Add IT_PERSONNEL to audit byRecord route

**Files:**
- Modify: `Backend/src/audit/audit.controller.ts`

- [ ] **Step 1.1: Open the file and find the byRecord route**

```bash
cd Backend && grep -n "byRecord\|record" src/audit/audit.controller.ts
```

Expected output shows the route at around line 57.

- [ ] **Step 1.2: Update the @Roles decorator**

In `Backend/src/audit/audit.controller.ts`, find the `GET record/:recordId` route and change:

```typescript
// Before — find this block:
@Get('record:recordId')
@Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
async findByRecord(@Param('recordId', ParseUUIDPipe) recordId: string) {

// After — replace with:
@Get('record/:recordId')
@Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT, UserRole.IT_PERSONNEL)
async findByRecord(@Param('recordId', ParseUUIDPipe) recordId: string) {
```

Note: also fix the missing `/` in `record:recordId` → `record/:recordId` if present.

- [ ] **Step 1.3: TypeScript check**

```bash
cd Backend && npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 1.4: Commit**

```bash
git add Backend/src/audit/audit.controller.ts
git commit -m "fix: add IT_PERSONNEL access to audit byRecord route"
```

---

## Task 2: Create UpdateAssetDto

**Files:**
- Create: `Backend/src/assets/dto/update-asset.dto.ts`

- [ ] **Step 2.1: Create the file**

Create `Backend/src/assets/dto/update-asset.dto.ts` with this exact content:

```typescript
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetCondition } from '../../../../packages/shared/src/enums';

export class UpdateAssetDto {
  @IsOptional() @IsString() sapClassification?: string;
  @IsOptional() @IsString() itemCode?: string;
  @IsOptional() @IsString() itemDescription?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() propertyNumber?: string;
  @IsOptional() @IsString() components?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  acquisitionCost?: number;

  @IsOptional() @IsDateString() acquisitionDate?: string;
  @IsOptional() @IsString() accountableOfficer?: string;
  @IsOptional() @IsString() division?: string;
  @IsOptional() @IsString() officeOrSection?: string;
  @IsOptional() @IsString() officeLocation?: string;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsDateString() dateOfDelivery?: string;
}
```

- [ ] **Step 2.2: TypeScript check**

```bash
cd Backend && npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 2.3: Commit**

```bash
git add Backend/src/assets/dto/update-asset.dto.ts
git commit -m "feat: add UpdateAssetDto for asset field editing"
```

---

## Task 3: Add update() to AssetsService (TDD)

**Files:**
- Modify: `Backend/src/assets/assets.service.ts`
- Modify: `Backend/src/assets/assets.service.spec.ts`

- [ ] **Step 3.1: Write the failing test**

In `Backend/src/assets/assets.service.spec.ts`, find the existing `describe('AssetsService')` block and add this test section after the existing tests:

```typescript
// ── Section: update() ──────────────────────────────────────────────────────
describe('update()', () => {
  it('updates editable fields and writes ASSET_UPDATED audit log', async () => {
    const asset = {
      id: 'asset-1',
      itemDescription: 'Old Laptop',
      brand: 'Dell',
      status: AssetStatus.AVAILABLE,
    } as AssetEntity;

    mockAssetRepo.findOne.mockResolvedValue(asset);
    mockAssetRepo.update.mockResolvedValue({ affected: 1 });
    mockAssetRepo.findOne.mockResolvedValueOnce(asset).mockResolvedValueOnce({
      ...asset,
      itemDescription: 'New Laptop',
      brand: 'Lenovo',
    } as AssetEntity);

    const dto = { itemDescription: 'New Laptop', brand: 'Lenovo' };
    const result = await service.update('asset-1', dto, 'user-1', UserRole.IT_PERSONNEL, '127.0.0.1');

    expect(mockAssetRepo.update).toHaveBeenCalledWith('asset-1', dto);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ASSET_UPDATED,
        affectedRecordId: 'asset-1',
        userId: 'user-1',
      }),
    );
    expect(result.itemDescription).toBe('New Laptop');
  });

  it('throws NotFoundException when asset does not exist', async () => {
    mockAssetRepo.findOne.mockResolvedValue(null);

    await expect(
      service.update('missing-id', { brand: 'X' }, 'user-1', UserRole.IT_PERSONNEL, '127.0.0.1'),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd Backend && npm run test -- --testPathPattern="assets.service.spec" --no-coverage
```

Expected: FAIL — `service.update is not a function`

- [ ] **Step 3.3: Add update() to AssetsService**

In `Backend/src/assets/assets.service.ts`, add this import at the top alongside existing imports:

```typescript
import { UpdateAssetDto } from './dto/update-asset.dto';
```

Then add this method to the `AssetsService` class, after the `create()` method and before `updateLifecycle()`:

```typescript
// ── Update editable asset fields (IT Personnel only) ─────────────────────
// SVC: Deliver and Support — correction of asset record details
async update(
  id: string,
  dto: UpdateAssetDto,
  performedById: string,
  userRole: UserRole,
  ipAddress: string,
): Promise<AssetEntity> {
  await this.findOne(id); // throws NotFoundException if not found
  await this.assetRepo.update(id, dto);

  await this.auditService.log({
    userId: performedById,
    userRole,
    action: AuditAction.ASSET_UPDATED,
    affectedRecordId: id,
    affectedRecordType: 'asset',
    ipAddress,
    metadata: { updatedFields: Object.keys(dto) },
  });

  return this.findOne(id);
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
cd Backend && npm run test -- --testPathPattern="assets.service.spec" --no-coverage
```

Expected: all tests PASS including the two new ones.

- [ ] **Step 3.5: Commit**

```bash
git add Backend/src/assets/assets.service.ts Backend/src/assets/assets.service.spec.ts
git commit -m "feat: add update() to AssetsService with audit logging"
```

---

## Task 4: Add PATCH :id endpoint to AssetsController

**Files:**
- Modify: `Backend/src/assets/assets.controller.ts`

- [ ] **Step 4.1: Add UpdateAssetDto import**

In `Backend/src/assets/assets.controller.ts`, add to the existing import from `./dto/...`:

```typescript
import { UpdateAssetDto } from './dto/update-asset.dto';
```

- [ ] **Step 4.2: Add the endpoint**

In `Backend/src/assets/assets.controller.ts`, add this method after the existing `create()` method and before `updateLifecycle()`:

```typescript
/**
 * PATCH /api/v1/assets/:id
 * Update editable asset fields. Does NOT change lifecycle status.
 * Roles: IT Personnel only
 */
@Patch(':id')
@Roles(UserRole.IT_PERSONNEL)
async update(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateAssetDto,
  @Req() req: AuthenticatedRequest,
) {
  const asset = await this.assetsService.update(
    id,
    dto,
    req.user.id,
    req.user.role,
    req.ip,
  );
  return { message: 'Asset updated successfully', data: asset };
}
```

- [ ] **Step 4.3: TypeScript check**

```bash
cd Backend && npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 4.4: Build check**

```bash
cd Backend && npm run build
```

Expected: `webpack compiled successfully`

- [ ] **Step 4.5: Commit**

```bash
git add Backend/src/assets/assets.controller.ts
git commit -m "feat: add PATCH /assets/:id endpoint for field updates"
```

---

## Task 5: Add employeeId resolution to updateLifecycle()

**Files:**
- Modify: `Backend/src/assets/dto/update-lifecycle.dto.ts`
- Modify: `Backend/src/assets/assets.service.ts`
- Modify: `Backend/src/assets/assets.module.ts`
- Modify: `Backend/src/assets/assets.service.spec.ts`

- [ ] **Step 5.1: Add employeeId field to UpdateLifecycleDto**

In `Backend/src/assets/dto/update-lifecycle.dto.ts`, add after the existing `custodianId` field:

```typescript
@IsOptional()
@IsString()
@IsNotEmpty()
employeeId?: string; // Alternative to custodianId — resolved to UUID by service
```

- [ ] **Step 5.2: Import UsersModule in AssetsModule**

In `Backend/src/assets/assets.module.ts`, replace the full file content with:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetEntity } from './entities/asset.entity';
import { AssetTransactionEntity } from './entities/asset-transaction.entity';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

// SVC: Obtain/Build & Deliver and Support — asset registration and lifecycle management

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetEntity, AssetTransactionEntity]),
    AuditModule,
    UsersModule, // Required — employeeId lookup for ISSUED transitions
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
```

- [ ] **Step 5.3: Inject UsersService into AssetsService**

In `Backend/src/assets/assets.service.ts`, add to the imports at the top:

```typescript
import { UsersService } from '../users/users.service';
```

Then update the constructor to inject it:

```typescript
constructor(
  @InjectRepository(AssetEntity)
  private readonly assetRepo: Repository<AssetEntity>,
  @InjectRepository(AssetTransactionEntity)
  private readonly txRepo: Repository<AssetTransactionEntity>,
  private readonly auditService: AuditService,
  private readonly usersService: UsersService,
) {}
```

- [ ] **Step 5.4: Write the failing test for employeeId resolution**

In `Backend/src/assets/assets.service.spec.ts`, find the existing mock setup block (near the top of the describe) and add a `mockUsersService` mock:

```typescript
const mockUsersService = {
  findByEmployeeId: jest.fn(),
};
```

Add it to the module providers in the `beforeEach` `Test.createTestingModule` call:

```typescript
{ provide: UsersService, useValue: mockUsersService },
```

Add this import at the top of the spec file:

```typescript
import { UsersService } from '../users/users.service';
```

Then add this test inside the `updateLifecycle() — valid transitions` describe block:

```typescript
it('resolves employeeId to UUID when status is ISSUED', async () => {
  const asset = {
    id: 'asset-1',
    status: AssetStatus.AVAILABLE,
    custodianId: null,
  } as AssetEntity;
  const recipient = { id: 'user-uuid-123', employeeId: 'CICC-0042' } as any;

  mockAssetRepo.findOne.mockResolvedValue(asset);
  mockAssetRepo.save.mockResolvedValue({ ...asset, status: AssetStatus.ISSUED, custodianId: 'user-uuid-123' });
  mockTxRepo.create.mockReturnValue({});
  mockTxRepo.save.mockResolvedValue({});
  mockUsersService.findByEmployeeId.mockResolvedValue(recipient);

  await service.updateLifecycle(
    'asset-1',
    { status: AssetStatus.ISSUED, employeeId: 'CICC-0042' },
    'performer-1',
    UserRole.IT_PERSONNEL,
    '127.0.0.1',
  );

  expect(mockUsersService.findByEmployeeId).toHaveBeenCalledWith('CICC-0042');
  expect(mockAssetRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ custodianId: 'user-uuid-123' }),
  );
});

it('throws BadRequestException when employeeId is not found', async () => {
  const asset = { id: 'asset-1', status: AssetStatus.AVAILABLE } as AssetEntity;
  mockAssetRepo.findOne.mockResolvedValue(asset);
  mockUsersService.findByEmployeeId.mockResolvedValue(null);

  await expect(
    service.updateLifecycle(
      'asset-1',
      { status: AssetStatus.ISSUED, employeeId: 'CICC-XXXX' },
      'performer-1',
      UserRole.IT_PERSONNEL,
      '127.0.0.1',
    ),
  ).rejects.toThrow(BadRequestException);
});
```

- [ ] **Step 5.5: Run tests to verify they fail**

```bash
cd Backend && npm run test -- --testPathPattern="assets.service.spec" --no-coverage
```

Expected: FAIL on the two new employeeId tests.

- [ ] **Step 5.6: Add employeeId resolution logic to updateLifecycle()**

In `Backend/src/assets/assets.service.ts`, inside `updateLifecycle()`, find this line:

```typescript
if (dto.custodianId !== undefined) asset.custodianId = dto.custodianId;
```

Replace it with:

```typescript
// Resolve employeeId → UUID if provided (IT Personnel don't know raw UUIDs)
if (dto.employeeId && dto.status === AssetStatus.ISSUED) {
  const recipient = await this.usersService.findByEmployeeId(dto.employeeId);
  if (!recipient) {
    throw new BadRequestException(
      `No user found with employee ID "${dto.employeeId}".`,
    );
  }
  asset.custodianId = recipient.id;
} else if (dto.custodianId !== undefined) {
  asset.custodianId = dto.custodianId;
}
```

- [ ] **Step 5.7: Run tests to verify they pass**

```bash
cd Backend && npm run test -- --testPathPattern="assets.service.spec" --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5.8: TypeScript + build check**

```bash
cd Backend && npx tsc --noEmit && npm run build
```

Expected: no TS errors, `webpack compiled successfully`.

- [ ] **Step 5.9: Commit**

```bash
git add Backend/src/assets/dto/update-lifecycle.dto.ts Backend/src/assets/assets.service.ts Backend/src/assets/assets.module.ts Backend/src/assets/assets.service.spec.ts
git commit -m "feat: resolve employeeId to UUID in lifecycle ISSUED transition"
```

---

## Task 6: Update frontend API client

**Files:**
- Modify: `Frontend/lib/api/assets.ts`

- [ ] **Step 6.1: Add UpdateAssetDto interface and update method**

In `Frontend/lib/api/assets.ts`, add this interface after the existing `UpdateLifecycleDto`:

```typescript
export interface UpdateAssetDto {
  sapClassification?: string;
  itemCode?: string;
  itemDescription?: string;
  brand?: string;
  serialNumber?: string;
  propertyNumber?: string;
  components?: string;
  acquisitionCost?: number;
  acquisitionDate?: string;
  accountableOfficer?: string;
  division?: string;
  officeOrSection?: string;
  officeLocation?: string;
  condition?: string;
  supplier?: string;
  dateOfDelivery?: string;
}
```

- [ ] **Step 6.2: Update UpdateLifecycleDto interface**

In `Frontend/lib/api/assets.ts`, replace the existing `UpdateLifecycleDto` interface with:

```typescript
export interface UpdateLifecycleDto {
  status: string;
  notes?: string;
  employeeId?: string;    // For ISSUED — backend resolves to custodian UUID
  toLocation?: string;    // For TRANSFERRED — receiving office/section
  fromLocation?: string;
}
```

- [ ] **Step 6.3: Add update() to assetsApi**

In `Frontend/lib/api/assets.ts`, add to the `assetsApi` object after `generateQr`:

```typescript
update: (id: string, dto: UpdateAssetDto) =>
  client.patch<ApiResponse<Asset>>(`/v1/assets/${id}`, dto).then((r) => r.data),
```

- [ ] **Step 6.4: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 6.5: Commit**

```bash
git add Frontend/lib/api/assets.ts
git commit -m "feat: add update() and UpdateAssetDto to assets API client"
```

---

## Task 7: Add edit mode to the detail page

**Files:**
- Modify: `Frontend/app/it-personnel/assets/[id]/page.tsx`

- [ ] **Step 7.1: Add edit state and form state**

In `Frontend/app/it-personnel/assets/[id]/page.tsx`, add these imports at the top:

```typescript
import { Pencil, Save, X, Clock, AlertTriangle } from 'lucide-react';
import { assetsApi, type Asset, type UpdateAssetDto } from '@/lib/api/assets';
import { auditApi, type AuditLog } from '@/lib/api/audit';
```

Add these state variables after the existing ones:

```typescript
const [edit, setEdit] = useState(false);
const [editForm, setEditForm] = useState<UpdateAssetDto>({});
const [saving, setUpdating] = useState(false);
const [saveError, setSaveError] = useState('');
const [transactions, setTransactions] = useState<AuditLog[]>([]);
const [historyLoading, setHistoryLoading] = useState(true);
const [formSuggestion, setFormSuggestion] = useState<string | null>(null);
```

- [ ] **Step 7.2: Load history in parallel with asset**

Replace the existing `useEffect` block with:

```typescript
useEffect(() => {
  Promise.all([
    assetsApi.getOne(id).then((res) => {
      setAsset(res.data);
      setEditForm({
        itemDescription: res.data.itemDescription,
        brand: res.data.brand,
        serialNumber: res.data.serialNumber,
        propertyNumber: res.data.propertyNumber,
        sapClassification: res.data.sapClassification,
        itemCode: res.data.itemCode,
        components: res.data.components,
        acquisitionCost: res.data.acquisitionCost,
        acquisitionDate: res.data.acquisitionDate,
        accountableOfficer: res.data.accountableOfficer,
        division: res.data.division,
        officeOrSection: res.data.officeOrSection,
        officeLocation: res.data.officeLocation,
        condition: res.data.condition,
        supplier: res.data.supplier,
        dateOfDelivery: res.data.dateOfDelivery,
      });
    }),
    auditApi.byRecord(id).then((res) => setTransactions(res.data?.data ?? [])).catch(() => {}),
  ])
    .catch(() => {})
    .finally(() => { setLoading(false); setHistoryLoading(false); });
}, [id]);
```

- [ ] **Step 7.3: Add handleSave function**

Add this function after `handleGenerateQr`:

```typescript
const handleSave = async () => {
  if (!asset) return;
  setUpdating(true);
  setSaveError('');
  try {
    const res = await assetsApi.update(asset.id, editForm);
    setAsset(res.data);
    setEdit(false);
    auditApi.byRecord(id).then((r) => setTransactions(r.data?.data ?? [])).catch(() => {});
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setSaveError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to save.'));
  } finally {
    setUpdating(false);
  }
};

const handleCancelEdit = () => {
  if (!asset) return;
  setEdit(false);
  setSaveError('');
  setEditForm({
    itemDescription: asset.itemDescription,
    brand: asset.brand,
    serialNumber: asset.serialNumber,
    propertyNumber: asset.propertyNumber,
    sapClassification: asset.sapClassification,
    itemCode: asset.itemCode,
    components: asset.components,
    acquisitionCost: asset.acquisitionCost,
    acquisitionDate: asset.acquisitionDate,
    accountableOfficer: asset.accountableOfficer,
    division: asset.division,
    officeOrSection: asset.officeOrSection,
    officeLocation: asset.officeLocation,
    condition: asset.condition,
    supplier: asset.supplier,
    dateOfDelivery: asset.dateOfDelivery,
  });
};
```

- [ ] **Step 7.4: Replace the header button group**

Find the existing button group in the JSX (the `<div className="flex gap-2 flex-wrap">` block) and replace it with:

```tsx
<div className="flex gap-2 flex-wrap">
  {edit ? (
    <>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
      </button>
      <button
        onClick={handleCancelEdit}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <X className="w-4 h-4" /> Cancel
      </button>
    </>
  ) : (
    <>
      <button
        onClick={() => setEdit(true)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Pencil className="w-4 h-4" /> Edit
      </button>
      {!asset.qrCode && (
        <button
          onClick={handleGenerateQr}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <QrCode className="w-4 h-4" /> Generate QR
        </button>
      )}
      {nextStates.length > 0 && (
        <button
          onClick={() => setShowLifecycle(true)}
          className="px-4 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors"
        >
          Update Lifecycle
        </button>
      )}
    </>
  )}
</div>
```

- [ ] **Step 7.5: Add save error banner below the header**

After the QR code strip block, add:

```tsx
{saveError && (
  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{saveError}</div>
)}
```

- [ ] **Step 7.6: Replace the four DetailSection blocks with edit-aware versions**

Add a helper input class constant after the existing `inputClass`:

```typescript
const fieldClass = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]';
```

Add a helper component above the `AssetDetailPage` function (at module scope):

```tsx
function EditableDetail({
  label,
  field,
  value,
  editValue,
  edit,
  onChange,
  type = 'text',
  options,
}: {
  label: string;
  field: string;
  value?: string | number | null;
  editValue?: string | number;
  edit: boolean;
  onChange: (field: string, val: string) => void;
  type?: string;
  options?: string[];
}) {
  const fieldClass = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a]';
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</dt>
      {edit ? (
        options ? (
          <select value={editValue ?? ''} onChange={(e) => onChange(field, e.target.value)} className={fieldClass}>
            <option value="">— select —</option>
            {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={editValue ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            className={fieldClass}
          />
        )
      ) : (
        <dd className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value ?? 'Not specified'}</dd>
      )}
    </div>
  );
}
```

Then replace the existing `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` block with:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <DetailSection title="Classification">
    <EditableDetail label="SAP Classification" field="sapClassification" value={asset.sapClassification} editValue={editForm.sapClassification} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Item Code" field="itemCode" value={asset.itemCode} editValue={editForm.itemCode} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Item Description" field="itemDescription" value={asset.itemDescription} editValue={editForm.itemDescription} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Brand" field="brand" value={asset.brand} editValue={editForm.brand} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Serial Number" field="serialNumber" value={asset.serialNumber} editValue={editForm.serialNumber} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Asset Class" field="assetClass" value={asset.assetClass} edit={false} onChange={() => {}} />
    <EditableDetail label="Asset Type" field="assetType" value={asset.assetType} edit={false} onChange={() => {}} />
  </DetailSection>

  <DetailSection title="Accountability">
    <EditableDetail label="Accountable Officer" field="accountableOfficer" value={asset.accountableOfficer} editValue={editForm.accountableOfficer} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Division" field="division" value={asset.division} editValue={editForm.division} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Office / Section" field="officeOrSection" value={asset.officeOrSection} editValue={editForm.officeOrSection} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Location" field="officeLocation" value={asset.officeLocation} editValue={editForm.officeLocation} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Condition" field="condition" value={asset.condition?.replace(/_/g, ' ')} editValue={editForm.condition} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} options={['SERVICEABLE', 'UNSERVICEABLE', 'FOR_REPAIR', 'FOR_DISPOSAL']} />
    <EditableDetail label="Components" field="components" value={asset.components} editValue={editForm.components} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
  </DetailSection>

  <DetailSection title="Acquisition">
    <EditableDetail label="Cost (PHP)" field="acquisitionCost" value={asset.acquisitionCost ? `₱ ${Number(asset.acquisitionCost).toLocaleString()}` : null} editValue={editForm.acquisitionCost} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} type="number" />
    <EditableDetail label="Acquisition Date" field="acquisitionDate" value={asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString() : null} editValue={editForm.acquisitionDate?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} type="date" />
    <EditableDetail label="Supplier" field="supplier" value={asset.supplier} editValue={editForm.supplier} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} />
    <EditableDetail label="Date of Delivery" field="dateOfDelivery" value={asset.dateOfDelivery ? new Date(asset.dateOfDelivery).toLocaleDateString() : null} editValue={editForm.dateOfDelivery?.slice(0, 10)} edit={edit} onChange={(f, v) => setEditForm((p) => ({ ...p, [f]: v }))} type="date" />
  </DetailSection>

  <DetailSection title="System">
    <Detail label="Asset ID" value={asset.id} />
    <Detail label="Custodian ID" value={asset.custodianId ? `···${asset.custodianId.slice(-8)}` : null} />
    <Detail label="Barcode" value={asset.barcodeValue} />
    <Detail label="Registered" value={new Date(asset.createdAt).toLocaleDateString()} />
    <Detail label="Last Updated" value={new Date(asset.updatedAt).toLocaleDateString()} />
  </DetailSection>
</div>
```

- [ ] **Step 7.7: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 7.8: ESLint check**

```bash
cd Frontend && npx eslint app/it-personnel/assets/\\[id\\]/page.tsx --max-warnings 0
```

Fix any issues with `--fix` first, then resolve remaining errors manually.

- [ ] **Step 7.9: Commit**

```bash
git add Frontend/app/it-personnel/assets/\[id\]/page.tsx
git commit -m "feat: add edit mode to asset detail page"
```

---

## Task 8: Context-aware lifecycle modal

**Files:**
- Modify: `Frontend/app/it-personnel/assets/[id]/page.tsx`

- [ ] **Step 8.1: Add extra lifecycle form state**

Add these state variables alongside the existing lifecycle state variables:

```typescript
const [lifecycleEmployeeId, setLifecycleEmployeeId] = useState('');
const [lifecycleToLocation, setLifecycleToLocation] = useState('');
```

- [ ] **Step 8.2: Update handleLifecycleUpdate to pass new fields**

Replace the existing `handleLifecycleUpdate` function body with:

```typescript
const handleLifecycleUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!targetStatus) return;
  setUpdating(true);
  setLifecycleError('');
  try {
    const dto: { status: string; notes?: string; employeeId?: string; toLocation?: string } = {
      status: targetStatus,
      notes: lifecycleNotes || undefined,
    };
    if (targetStatus === 'ISSUED' && lifecycleEmployeeId) dto.employeeId = lifecycleEmployeeId;
    if (targetStatus === 'TRANSFERRED' && lifecycleToLocation) dto.toLocation = lifecycleToLocation;

    const res = await assetsApi.updateLifecycle(id, dto);
    setAsset(res.data);

    // Determine form suggestion
    if (targetStatus === 'ISSUED') {
      setFormSuggestion(res.data.assetClass === 'PPE' ? 'PAR' : res.data.assetClass === 'SEMI_EXPENDABLE' ? 'ICS' : null);
    } else if (targetStatus === 'TRANSFERRED') {
      setFormSuggestion('PTR');
    } else if (targetStatus === 'FLAGGED_FOR_DISPOSAL') {
      setFormSuggestion('IIRUP');
    } else {
      setFormSuggestion(null);
    }

    auditApi.byRecord(id).then((r) => setTransactions(r.data?.data ?? [])).catch(() => {});
    setShowLifecycle(false);
    setTargetStatus('');
    setLifecycleNotes('');
    setLifecycleEmployeeId('');
    setLifecycleToLocation('');
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setLifecycleError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to update.'));
  } finally {
    setUpdating(false);
  }
};
```

- [ ] **Step 8.3: Replace the lifecycle modal form fields**

Inside the lifecycle modal `<form>`, after the existing `<select>` for New Status and before the button row, replace the existing notes `<textarea>` with:

```tsx
{targetStatus === 'ISSUED' && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Employee ID *</label>
    <input
      type="text"
      value={lifecycleEmployeeId}
      onChange={(e) => setLifecycleEmployeeId(e.target.value)}
      placeholder="e.g. CICC-0042"
      required
      className={inputClass}
    />
    <p className="text-xs text-gray-400 mt-1">Enter the recipient's Employee ID. The system will look them up.</p>
  </div>
)}
{targetStatus === 'TRANSFERRED' && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Receiving Office / Section *</label>
    <input
      type="text"
      value={lifecycleToLocation}
      onChange={(e) => setLifecycleToLocation(e.target.value)}
      placeholder="e.g. Cybercrime Division, Cebu"
      required
      className={inputClass}
    />
  </div>
)}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Notes / Justification {targetStatus === 'FLAGGED_FOR_DISPOSAL' ? '*' : ''}
  </label>
  <textarea
    value={lifecycleNotes}
    onChange={(e) => setLifecycleNotes(e.target.value)}
    rows={3}
    required={targetStatus === 'FLAGGED_FOR_DISPOSAL'}
    placeholder={
      targetStatus === 'FLAGGED_FOR_DISPOSAL'
        ? 'Required: describe the reason for disposal...'
        : 'Optional notes for audit trail...'
    }
    className={inputClass}
  />
</div>
```

- [ ] **Step 8.4: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 8.5: Commit**

```bash
git add Frontend/app/it-personnel/assets/\[id\]/page.tsx
git commit -m "feat: context-aware lifecycle modal with employeeId and toLocation fields"
```

---

## Task 9: Transaction history panel + form suggestion banner

**Files:**
- Modify: `Frontend/app/it-personnel/assets/[id]/page.tsx`

- [ ] **Step 9.1: Add form suggestion banner**

After the QR code strip block (and after the `saveError` banner), add:

```tsx
{formSuggestion && (
  <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
    <div className="flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0" />
      <p className="text-sm text-blue-800">
        Lifecycle updated — consider generating the <strong>{formSuggestion}</strong> form to document this transaction.
      </p>
    </div>
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => router.push('/it-personnel/forms')}
        className="px-3 py-1.5 bg-[#1a4d7a] text-white text-xs font-medium rounded hover:bg-[#143d61] transition-colors"
      >
        Go to Forms
      </button>
      <button
        onClick={() => setFormSuggestion(null)}
        className="px-3 py-1.5 border border-blue-200 text-blue-700 text-xs font-medium rounded hover:bg-blue-100 transition-colors"
      >
        Dismiss
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 9.2: Add transaction history panel**

After the closing `</div>` of the 2×2 detail grid and before the lifecycle modal, add:

```tsx
{/* Transaction History */}
<div className="bg-white rounded-lg border border-gray-200">
  <div className="p-5 border-b border-gray-200 flex items-center gap-2">
    <Clock className="w-4 h-4 text-[#1a4d7a]" />
    <h3 className="text-xs font-bold text-[#1a4d7a] uppercase tracking-wider">Transaction History</h3>
  </div>
  {historyLoading ? (
    <div className="p-6"><LoadingSkeleton rows={4} /></div>
  ) : transactions.length === 0 ? (
    <p className="px-5 py-8 text-sm text-gray-400 text-center">No lifecycle history recorded yet.</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {['Date / Time', 'Action', 'Performed By', 'Notes'].map((h) => (
              <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-gray-50">
              <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">
                {new Date(tx.timestamp).toLocaleString()}
              </td>
              <td className="px-5 py-3">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                  {tx.action.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-5 py-3 text-sm font-mono text-gray-500">
                ···{tx.userId.slice(-8)}
              </td>
              <td className="px-5 py-3 text-sm text-gray-600">
                {(tx.metadata as { notes?: string })?.notes ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

- [ ] **Step 9.3: TypeScript + ESLint check**

```bash
cd Frontend && npx tsc --noEmit && npx eslint app/it-personnel/assets/\\[id\\]/page.tsx --max-warnings 0
```

Expected: no output, exit code 0 on both.

- [ ] **Step 9.4: Full checks**

```bash
cd Backend && npm run test && npx tsc --noEmit
cd Frontend && npm run build
```

Expected: all Backend tests pass, Frontend builds successfully.

- [ ] **Step 9.5: Final commit**

```bash
git add Frontend/app/it-personnel/assets/\[id\]/page.tsx
git commit -m "feat: add transaction history panel and form suggestion banner to asset detail page"
```

---

## Self-Review Checklist

- [x] **Spec §0 Edit mode** — Tasks 2, 3, 4, 6, 7 cover `UpdateAssetDto`, `update()` service, controller endpoint, API client, and frontend edit toggle
- [x] **Spec §1 History panel** — Task 1 (audit role), Task 7 (parallel fetch), Task 9 (panel UI)
- [x] **Spec §2 Context-aware lifecycle modal** — Task 5 (backend employeeId), Task 6 (API client fields), Task 8 (modal UI)
- [x] **Spec §3 Form suggestion banner** — Task 8 (formSuggestion state set on lifecycle update), Task 9 (banner UI)
- [x] **Spec §4 Custodian display** — Task 7 Step 7.6 (System section uses `···${id.slice(-8)}` + labeled "Custodian ID")
- [x] **Type consistency** — `UpdateAssetDto` defined in Task 2 (backend) and Task 6 (frontend); `employeeId` field added in Task 5 (backend DTO) and Task 6 (frontend interface); `formSuggestion` state string|null used consistently in Tasks 8 and 9
- [x] **No placeholders** — all code blocks are complete
