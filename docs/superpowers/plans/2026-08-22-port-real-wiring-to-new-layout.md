# Port Real Backend Wiring Into the Redesigned Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every redesigned-layout page that has a real backend equivalent (old layout, or another already-wired role) genuinely call that backend, in place of its current mock data — role by role, verified at each step.

**Architecture:** Two techniques, chosen per page based on what already exists:
1. **Extend `WorkflowPage.tsx`'s `isLiveFetchPage` pattern** (already proven for Approving Officer's live approvals queue) for pages whose real equivalent is a list-plus-row-actions UX (fulfillment, custody, maintenance, disposal).
2. **Extract the old layout's already-working page logic into a shared component**, parameterized so both the old page (thin wrapper) and the new layout's route can render it — for pages whose real UX is its own dedicated page, not a `WorkflowPage` row-action pattern (asset registry list/create/detail, dashboards).

**Tech Stack:** Next.js App Router, TypeScript strict, `Frontend/lib/api/*` axios clients, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-port-real-wiring-to-new-layout-design.md`

## Global Constraints

- Branch: all work happens on `feature/port-real-wiring-to-new-layout`. Commit (and push) after each task completes and verifies clean — one branch for the whole effort, not one per task.
- Enum/status values passed to the backend must match `packages/shared/src/enums/index.ts` exactly (lowercase snake_case) — this was the single biggest bug class found in the 2026-08-21 fix round; do not reintroduce it.
- **No React component test framework exists in this codebase** (confirmed: no `@testing-library/react`, no component render tests anywhere). Do not add one as a side effect of this plan. Verification per task is: `npx tsc --noEmit`, `npx eslint <changed files> --max-warnings 0` (both clean, zero output), `npm run test` (existing suite stays green), `npm run build` (all routes compile) — plus a plain-language description of what to click in the browser to confirm it, for the human to do since no automated equivalent exists. This replaces the "write failing test" step from the general task template for every frontend task in this plan.
- Never touch the old layout's page files' *behavior* except where a task explicitly extracts shared logic out of one (and even then, the old page keeps working identically afterward — verify by reading the diff, not just the new file).
- Every task ends with a real `git commit` (message describing what became real, referencing this plan file) — small, frequent commits, not one giant commit per phase.
- IT Personnel/`/it-personnel/*` credentials for manual verification: `itpersonnel@cicc.gov.ph` / `CiccIT@2026!Sec` (also grants `/it-asset-custodian/*` — same backend role, different route tree).

---

## Phase 1: IT Asset Custodian — ✅ COMPLETE (2026-08-22)

All 8 tasks implemented, individually reviewed clean, and closed out by a final
whole-branch review (0 Critical, 3 Important — all 3 fixed in one round and
re-reviewed clean, 11 Minor deferred; see the ledger at
`.superpowers/sdd/2026-08-22-port-real-wiring-to-new-layout/progress.md` and
`SYSTEM-STATUS.md`'s "Fixed 2026-08-22" section for the full account). Pushed
to `feature/port-real-wiring-to-new-layout`. Manual browser verification of
all 8 tasks is still the user's to do — see each task's "Manual check" step
below.

### Task 1: Wire Notifications to the real component

**Files:**
- Modify: `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `NotificationsContent` from `@/components/shared/NotificationsContent` (existing, no changes — already real, already used by Supervisor/IT Personnel/Admin/Management/Employee).

- [x] **Step 1: Add the real component and a router branch for it**

Current file:
```tsx
import { LaptopAssetDetail } from '@/components/assets/LaptopAssetDetail';
import { LaptopAssetForm } from '@/components/assets/LaptopAssetForm';
import { AssetInventoryGallery } from '@/components/inventory/AssetInventoryGallery';
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ItAssetCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.IT_ASSET_CUSTODIAN} />;
  if (segment === 'assets' && child === 'new') return <LaptopAssetForm />;
  if (segment === 'assets' && child) return <LaptopAssetDetail assetId={child} />;
  if (segment === 'assets') return <AssetInventoryGallery kind="ict" />;
  return <WorkflowPage role={ProposedUserRole.IT_ASSET_CUSTODIAN} slug={segment} />;
}
```

Replace with:
```tsx
import { LaptopAssetDetail } from '@/components/assets/LaptopAssetDetail';
import { LaptopAssetForm } from '@/components/assets/LaptopAssetForm';
import { AssetInventoryGallery } from '@/components/inventory/AssetInventoryGallery';
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { NotificationsContent } from '@/components/shared/NotificationsContent';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ItAssetCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.IT_ASSET_CUSTODIAN} />;
  if (segment === 'notifications') return <NotificationsContent />;
  if (segment === 'assets' && child === 'new') return <LaptopAssetForm />;
  if (segment === 'assets' && child) return <LaptopAssetDetail assetId={child} />;
  if (segment === 'assets') return <AssetInventoryGallery kind="ict" />;
  return <WorkflowPage role={ProposedUserRole.IT_ASSET_CUSTODIAN} slug={segment} />;
}
```

- [x] **Step 2: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0
```
Expected: no output from either command.

- [x] **Step 3: Manual check** (human, browser)

Log in as IT Personnel, go to `/it-asset-custodian/notifications`. Should show real notifications (or "No notifications" if none exist) and a working "Mark all as read" — not the old mock list.

- [x] **Step 4: Commit**

```bash
git add "Frontend/app/it-asset-custodian/[[...slug]]/page.tsx"
git commit -m "feat(it-asset-custodian): wire notifications to the real component"
git push
```

---

### Task 2: Wire the Dashboard to real data

**Files:**
- Create: `Frontend/components/it-asset-custodian/ItAssetCustodianDashboard.tsx`
- Modify: `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `assetsApi.stats()` → `AssetStats` (`{ total, available, issued, underRepair, flaggedForDisposal, transferred }`, `Frontend/lib/api/assets.ts`), `requisitionsApi.list(1, 15, 'pending_fulfillment')` → `PaginatedResponse<Requisition>` (`Frontend/lib/api/requisitions.ts`), `notificationsApi.list()` → `{ notifications, unreadCount }` (`Frontend/lib/api/notifications.ts`), `useAuth()` → `{ user }` (`Frontend/lib/auth/use-auth.ts`).
- Produces: `ItAssetCustodianDashboard` (no props) — rendered directly by the router for `segment === 'dashboard'`.

- [x] **Step 1: Write the component**

```tsx
// Frontend/components/it-asset-custodian/ItAssetCustodianDashboard.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Boxes, CheckCircle2, ClipboardList, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { assetsApi, type AssetStats } from '@/lib/api/assets';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';

export function ItAssetCustodianDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [pendingFulfillment, setPendingFulfillment] = useState<Requisition[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      assetsApi.stats(),
      requisitionsApi.list(1, 15, 'pending_fulfillment'),
      notificationsApi.list(),
    ])
      .then(([statsRes, reqRes, notifRes]) => {
        if (cancelled) return;
        setStats(statsRes.data);
        setPendingFulfillment(reqRes.data.data);
        setUnreadCount(notifRes.data.unreadCount);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load dashboard data. Please refresh the page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading dashboard...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">ICT Asset Custodian</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950">Good day, {user?.firstName ?? 'there'}</h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/it-asset-custodian/assets" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><Boxes className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Total assets</span><span className="text-2xl font-extrabold text-slate-950">{stats?.total ?? 0}</span></span>
        </Link>
        <Link href="/it-asset-custodian/assets" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Available</span><span className="text-2xl font-extrabold text-slate-950">{stats?.available ?? 0}</span></span>
        </Link>
        <Link href="/it-asset-custodian/fulfillment" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><ClipboardList className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Pending fulfillment</span><span className="text-2xl font-extrabold text-slate-950">{pendingFulfillment.length}</span></span>
        </Link>
        <Link href="/it-asset-custodian/maintenance" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700"><Wrench className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Under repair</span><span className="text-2xl font-extrabold text-slate-950">{stats?.underRepair ?? 0}</span></span>
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h2 className="text-[15px] font-extrabold text-slate-950">Awaiting Fulfillment</h2>
        </div>
        {pendingFulfillment.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Nothing awaiting fulfillment right now.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingFulfillment.slice(0, 6).map((req) => (
              <Link key={req.id} href="/it-asset-custodian/fulfillment" className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50">
                <span className="text-sm font-bold text-slate-950">{req.items[0]?.itemDescription ?? 'Requisition'}</span>
                <span className="text-xs text-slate-500">{req.requestNumber}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Unread notifications: {unreadCount} — <Link href="/it-asset-custodian/notifications" className="font-bold text-blue-700 hover:underline">view all</Link>
      </p>
    </div>
  );
}
```

- [x] **Step 2: Wire it into the router**

In `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`, add the import and replace the dashboard branch:
```tsx
import { ItAssetCustodianDashboard } from '@/components/it-asset-custodian/ItAssetCustodianDashboard';
```
```tsx
if (segment === 'dashboard') return <ItAssetCustodianDashboard />;
```
(Remove the now-unused `RoleDashboard` import only if nothing else in this file still uses it — it's still used nowhere else in this file after this change, so remove the import line for `RoleDashboard` too.)

- [x] **Step 3: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/it-asset-custodian/ItAssetCustodianDashboard.tsx "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run build
```
Expected: all three clean/succeed.

- [x] **Step 4: Manual check** (human, browser)

Log in as IT Personnel. Land on `/it-asset-custodian/dashboard`. KPI numbers should match what you see on `/it-personnel/dashboard` for the same account (both read the same backend). Clicking "Pending fulfillment" or "Under repair" navigates correctly.

- [x] **Step 5: Commit**

```bash
git add Frontend/components/it-asset-custodian/ItAssetCustodianDashboard.tsx "Frontend/app/it-asset-custodian/[[...slug]]/page.tsx"
git commit -m "feat(it-asset-custodian): wire dashboard to real asset/requisition/notification data"
git push
```

---

### Task 3: Wire QR/Barcode Lookup to the real component

**Files:**
- Create: `Frontend/components/assets/QrLookup.tsx` (extracted from `Frontend/app/it-personnel/qr-scan/page.tsx`, parameterized so both routes can use it)
- Modify: `Frontend/app/it-personnel/qr-scan/page.tsx` (becomes a thin wrapper — old layout keeps working identically)
- Modify: `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `assetsApi.list` (search), `Asset` type (`Frontend/lib/api/assets.ts`).
- Produces: `QrLookup({ detailBasePath }: { detailBasePath: string })` — `detailBasePath` is prepended to the found asset's id when navigating to its detail page, since the two layouts have different asset-detail URLs (`/it-personnel/assets/:id` vs `/it-asset-custodian/assets/:id`).

- [x] **Step 1: Create the shared component**

This is the existing `Frontend/app/it-personnel/qr-scan/page.tsx` content, with the hardcoded `/it-personnel/assets/${result.id}` navigation replaced by a `detailBasePath` prop, and the component renamed/exported instead of being a default page export:

```tsx
// Frontend/components/assets/QrLookup.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Search } from 'lucide-react';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';

export function QrLookup({ detailBasePath }: Readonly<{ detailBasePath: string }>) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Asset | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await assetsApi.list(1, 5, query.trim());
      const items = Array.isArray(res.data)
        ? (res.data as Asset[])
        : ((res.data as unknown as { data: Asset[] }).data ?? []);
      if (items.length === 0) {
        setError('No asset found matching that QR code or property number.');
      } else {
        setResult(items[0]);
      }
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="QR / Barcode Lookup" />

      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 space-y-5">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            <QrCode className="w-8 h-8 text-[#1a4d7a]" />
          </div>
          <p className="text-sm text-gray-500 text-center">
            Scan a QR code using your device camera, or enter a QR code value / property number below.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="QR code value or property number..."
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
        )}

        {result && (
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <div className="bg-blue-50 p-4 border-b border-blue-200">
              <h3 className="font-semibold text-[#1a4d7a]">{result.itemDescription}</h3>
              <p className="text-sm text-gray-500 font-mono mt-0.5">{result.propertyNumber ?? result.id}</p>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <StatusBadge status={result.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Brand</span>
                <span className="text-gray-800">{result.brand ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="text-gray-800">{result.officeOrSection ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Condition</span>
                <span className="text-gray-800 capitalize">{result.condition?.replace(/_/g, ' ') ?? '—'}</span>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <button type="button"
                onClick={() => router.push(`${detailBasePath}/${result.id}`)}
                className="w-full py-2 bg-[#1a4d7a] text-white rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors"
              >
                View Full Asset Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Make the old page a thin wrapper**

Replace the full contents of `Frontend/app/it-personnel/qr-scan/page.tsx` with:
```tsx
import { QrLookup } from '@/components/assets/QrLookup';

export default function QrScanPage() {
  return <QrLookup detailBasePath="/it-personnel/assets" />;
}
```

- [x] **Step 3: Wire it into the new layout's router**

In `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`, add the import and a branch before the final `WorkflowPage` fallback:
```tsx
import { QrLookup } from '@/components/assets/QrLookup';
```
```tsx
if (segment === 'qr-scanner') return <QrLookup detailBasePath="/it-asset-custodian/assets" />;
```

- [x] **Step 4: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/assets/QrLookup.tsx app/it-personnel/qr-scan/page.tsx "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run build
```

- [x] **Step 5: Manual check** (human, browser)

`/it-personnel/qr-scan` still works exactly as before (old layout unaffected). `/it-asset-custodian/qr-scanner`, searching a real property number now returns a real result and "View Full Asset Details" navigates to `/it-asset-custodian/assets/:id` (which won't be real until Task 4 — that's expected at this point in the plan).

- [x] **Step 6: Commit**

```bash
git add Frontend/components/assets/QrLookup.tsx Frontend/app/it-personnel/qr-scan/page.tsx "Frontend/app/it-asset-custodian/[[...slug]]/page.tsx"
git commit -m "feat(it-asset-custodian): extract QR/barcode lookup into a shared component, wire to real layout"
git push
```

---

### Task 4: Wire the Asset Registry (list, register, detail/lifecycle) to real data

The largest task in this phase. Extracts the three already-working old-layout asset pages into shared components (parameterized by base path), then points the new layout at them instead of `AssetInventoryGallery`/`LaptopAssetForm`/`LaptopAssetDetail`.

**Files:**
- Create: `Frontend/components/assets/AssetRegistryList.tsx` (from `Frontend/app/it-personnel/assets/page.tsx`)
- Create: `Frontend/components/assets/RegisterAssetForm.tsx` (from `Frontend/app/it-personnel/assets/new/page.tsx`)
- Create: `Frontend/components/assets/AssetDetailManager.tsx` (from `Frontend/app/it-personnel/assets/[id]/page.tsx`)
- Modify: `Frontend/app/it-personnel/assets/page.tsx`, `Frontend/app/it-personnel/assets/new/page.tsx`, `Frontend/app/it-personnel/assets/[id]/page.tsx` (all become thin wrappers)
- Modify: `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Produces: `AssetRegistryList({ basePath }: { basePath: string })`, `RegisterAssetForm({ basePath }: { basePath: string })`, `AssetDetailManager({ assetId, basePath, formsPath }: { assetId: string; basePath: string; formsPath: string })`.
- `basePath` is the role's asset-section root (`/it-personnel/assets` or `/it-asset-custodian/assets`) — used to build every internal `Link`/`router.push` so the same component works under either route tree. `formsPath` is where `AssetDetailManager`'s "Go to Forms" button navigates (`/it-personnel/forms` today; IT Asset Custodian's forms page isn't real yet — point it at the same real `/it-personnel/forms` until forms get ported, since that's the only real forms page that exists).

- [x] **Step 1: Extract `AssetRegistryList`**

Copy the full current content of `Frontend/app/it-personnel/assets/page.tsx` into a new file `Frontend/components/assets/AssetRegistryList.tsx`, with these exact changes:
- Rename `export default function AssetsInventoryPage()` to `export function AssetRegistryList({ basePath }: Readonly<{ basePath: string }>)`.
- Replace `href="/it-personnel/assets/new"` with `href={`${basePath}/new`}`.
- Replace `href={`/it-personnel/assets/${asset.id}`}` with `href={`${basePath}/${asset.id}`}`.
- Everything else (imports, state, the search/filter logic, the table) stays identical.

- [x] **Step 2: Make the old list page a thin wrapper**

Replace the full contents of `Frontend/app/it-personnel/assets/page.tsx` with:
```tsx
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';

export default function AssetsInventoryPage() {
  return <AssetRegistryList basePath="/it-personnel/assets" />;
}
```

- [x] **Step 3: Extract `RegisterAssetForm`**

Copy the full current content of `Frontend/app/it-personnel/assets/new/page.tsx` into a new file `Frontend/components/assets/RegisterAssetForm.tsx`, with these exact changes:
- Rename `export default function NewAssetPage()` to `export function RegisterAssetForm({ basePath }: Readonly<{ basePath: string }>)`.
- In `handleSubmit`'s success path, replace `router.push(`/it-personnel/assets/${res.data.id}`)` with `router.push(`${basePath}/${res.data.id}`)`.
- Replace the "Back to Inventory" button's implicit target (it uses `router.back()`, no hardcoded path — leave unchanged).
- Everything else stays identical.

- [x] **Step 4: Make the old new-asset page a thin wrapper**

Replace the full contents of `Frontend/app/it-personnel/assets/new/page.tsx` with:
```tsx
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';

export default function NewAssetPage() {
  return <RegisterAssetForm basePath="/it-personnel/assets" />;
}
```

- [x] **Step 5: Extract `AssetDetailManager`**

Copy the full current content of `Frontend/app/it-personnel/assets/[id]/page.tsx` (503 lines — this is the file with the `NEXT_TRANSITIONS`/Condition-dropdown fixes from 2026-08-21, keep those fixes intact) into a new file `Frontend/components/assets/AssetDetailManager.tsx`, with these exact changes:
- Remove the `useParams`/`useRouter` import of `id` from the URL (`const params = useParams(); const id = params.id as string;`). Replace with props: `export function AssetDetailManager({ assetId, basePath, formsPath }: Readonly<{ assetId: string; basePath: string; formsPath: string }>)`. Every remaining reference to the local variable `id` in the file body becomes `assetId` (the `useEffect` dependency array, the `auditApi.byRecord(id)` calls, etc. — mechanical rename, no logic change).
- Rename `export default function AssetDetailPage()` accordingly (removed — it's the function signature above now).
- Replace `router.push('/it-personnel/forms')` with `router.push(formsPath)`.
- The "Back to Inventory" button uses `router.back()` — leave unchanged.
- Everything else (edit mode, the lifecycle modal, `NEXT_TRANSITIONS`, `optionLabel`, form-suggestion banner, transaction history) stays identical.

- [x] **Step 6: Make the old detail page a thin wrapper**

Replace the full contents of `Frontend/app/it-personnel/assets/[id]/page.tsx` with:
```tsx
'use client';

import { useParams } from 'next/navigation';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  return <AssetDetailManager assetId={params.id} basePath="/it-personnel/assets" formsPath="/it-personnel/forms" />;
}
```

- [x] **Step 7: Wire all three into the new layout's router**

In `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`, replace the `LaptopAssetDetail`/`LaptopAssetForm`/`AssetInventoryGallery` imports and their three branches:
```tsx
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
```
```tsx
if (segment === 'assets' && child === 'new') return <RegisterAssetForm basePath="/it-asset-custodian/assets" />;
if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/it-asset-custodian/assets" formsPath="/it-personnel/forms" />;
if (segment === 'assets') return <AssetRegistryList basePath="/it-asset-custodian/assets" />;
```
Remove the now-unused `LaptopAssetDetail`, `LaptopAssetForm`, `AssetInventoryGallery` imports — confirm nothing else in this file references them before deleting the import lines.

- [x] **Step 8: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/assets/AssetRegistryList.tsx components/assets/RegisterAssetForm.tsx components/assets/AssetDetailManager.tsx app/it-personnel/assets/page.tsx "app/it-personnel/assets/[id]/page.tsx" app/it-personnel/assets/new/page.tsx "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all clean/pass.

- [x] **Step 9: Manual check** (human, browser) — the important one, do all of it

1. `/it-personnel/assets`, `/it-personnel/assets/new`, `/it-personnel/assets/:id` all still work exactly as before (old layout unaffected — this is the critical regression check, since these three files' logic just moved).
2. `/it-asset-custodian/assets` — real asset list, same data as the old page.
3. Register a new asset via `/it-asset-custodian/assets/new` — succeeds, redirects to the new asset's `/it-asset-custodian/assets/:id`.
4. On that detail page: edit a field and save — persists after refresh. Run a lifecycle transition (issue/return/transfer/repair/dispose) — the "Update Lifecycle" button renders (confirms the 2026-08-21 casing fix carried over correctly) and the transition succeeds.
5. Generate a QR code on that asset, then go back to `/it-asset-custodian/qr-scanner` (Task 3) and look it up — should find it and link back here correctly.

- [x] **Step 10: Commit**

```bash
git add Frontend/components/assets/AssetRegistryList.tsx Frontend/components/assets/RegisterAssetForm.tsx Frontend/components/assets/AssetDetailManager.tsx Frontend/app/it-personnel/assets/page.tsx "Frontend/app/it-personnel/assets/[id]/page.tsx" Frontend/app/it-personnel/assets/new/page.tsx "Frontend/app/it-asset-custodian/[[...slug]]/page.tsx"
git commit -m "feat(it-asset-custodian): port asset registry (list/register/detail/lifecycle) to real data"
git push
```

**Note, not a step — flag for the user, don't act on it:** after this task, `Frontend/components/assets/LaptopAssetForm.tsx` and `LaptopAssetDetail.tsx` become orphaned (confirmed via grep: nothing imports them once the router change above lands, except their own `Frontend/lib/validation/laptop-asset.schema.ts` and `Frontend/__tests__/laptop-asset-form.test.ts`, which test the schema directly and don't depend on the component being wired up — that test should keep passing either way). Same deferred-deletion principle as the old-layout pages: don't delete these now, mention it's safe to once the user wants to.

---

### Task 5: Wire Fulfillment to real data

Real equivalent: the old `/it-personnel/requisitions/:id` page's fulfill/hold actions. The backend already auto-scopes `GET /v1/requisitions` results by the caller's role and asset-type (confirmed in a prior audit — `RequisitionsService.findAll()` scopes by assetType for IT/Property roles), so no client-side asset-type filtering is needed here — passing the `pending_fulfillment` status filter is enough.

Note: unlike Task 4, this task does NOT get a matching `next.config.ts` redirect entry — the old layout's fulfillment equivalent is a per-item detail page (`/it-personnel/requisitions/:id`) while the new layout's fulfillment is a list-with-row-drawer (no per-item subroute), so the URL shapes don't correspond 1:1 the way the asset pages did. Don't force a redirect where the shapes don't match.

**Files:**
- Modify: `Frontend/components/prototype/WorkflowPage.tsx`

**Interfaces:**
- Consumes: `requisitionsApi.fulfill(id: string)`, `requisitionsApi.hold(id: string, reason: string)` (existing, `Frontend/lib/api/requisitions.ts`).

- [x] **Step 1: Extend `isLiveFetchPage` and add the fulfillment-specific flag**

Current (`Frontend/components/prototype/WorkflowPage.tsx`, inside `WorkflowPage`):
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit');
```
Replace with:
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'fulfillment');
```

Then find `const isApprovingOfficerLiveApprovals = ...` (a few lines below) and add immediately after its statement:
```tsx
  const isItAssetCustodianLiveFulfillment =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'fulfillment';
```

- [x] **Step 2: Extend `fetchLiveRows` to fetch fulfillment rows**

Find this line inside `fetchLiveRows`:
```tsx
    const fetcher = normalizedSlug === 'approvals'
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT)
      : requisitionsApi.mine(1, LIVE_FETCH_LIMIT);
```
Replace with:
```tsx
    const fetcher = normalizedSlug === 'fulfillment'
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT, 'pending_fulfillment')
      : normalizedSlug === 'approvals'
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT)
      : requisitionsApi.mine(1, LIVE_FETCH_LIMIT);
```

- [x] **Step 3: Make `detailActions` live-aware for fulfillment**

Current:
```tsx
function detailActions(slug: string, role: ProposedUserRole) {
  if (slug === 'approvals') return ['Approve', 'Reject', 'Return for Revision'];
  if (slug === 'requisitions') return ['Cancel', 'Submit'];
  if (slug === 'assigned-assets') return ['Acknowledge', 'Return', 'Report Damage', 'Request Repair'];
  if (slug === 'fulfillment') return ['Reserve', 'Fulfill', 'On Hold'];
```
Replace with:
```tsx
function detailActions(slug: string, role: ProposedUserRole, isLive: boolean) {
  if (slug === 'approvals') return ['Approve', 'Reject', 'Return for Revision'];
  if (slug === 'requisitions') return ['Cancel', 'Submit'];
  if (slug === 'assigned-assets') return ['Acknowledge', 'Return', 'Report Damage', 'Request Repair'];
  // Live fulfillment only supports the two real backend actions — 'Reserve' has no
  // requisitionsApi equivalent, so it stays mock-only and is dropped once this is real.
  if (slug === 'fulfillment') return isLive ? ['Fulfill', 'On Hold'] : ['Reserve', 'Fulfill', 'On Hold'];
```
(Leave every other `if` branch in this function untouched — only the function signature and the `fulfillment` branch change.)

Then find the one call site of this function (inside the `DetailDrawer` JSX, where actions render as buttons):
```tsx
                {detailActions(normalizedSlug, role).map((action) => (
```
Replace with:
```tsx
                {detailActions(normalizedSlug, role, isItAssetCustodianLiveFulfillment).map((action) => (
```

- [x] **Step 4: Add `submitFulfillmentDecision`**

Find the end of the existing `submitApprovalDecision` function (it ends with a closing `};` followed by a blank line, then `const validateForm = () => {`). Insert this new function between them:
```tsx
  // Real, persisted counterpart to runAction for IT Asset Custodian's live fulfillment
  // queue — see isItAssetCustodianLiveFulfillment above. Calls the actual requisitions
  // API instead of mutating local mock state.
  const submitFulfillmentDecision = async (action: 'Fulfill' | 'On Hold') => {
    if (!selected || actionSubmitting) return;
    const trimmedRemarks = remarks.trim();
    if (action === 'On Hold' && !trimmedRemarks) {
      setErrors({ remarks: 'A reason is required to place a requisition on hold.' });
      return;
    }
    setActionSubmitting(true);
    try {
      const id = String(selected.id);
      if (action === 'Fulfill') {
        await requisitionsApi.fulfill(id);
      } else {
        await requisitionsApi.hold(id, trimmedRemarks);
      }
      setConfirmAction(null);
      setSelected(null);
      setRemarks('');
      setErrors({});
      notify(action === 'Fulfill' ? 'Requisition fulfilled.' : 'Requisition placed on hold.');
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch {
      notify(`Failed to ${action === 'Fulfill' ? 'fulfill' : 'place on hold'} the requisition. Please try again.`);
    } finally {
      setActionSubmitting(false);
    }
  };
```

- [x] **Step 5: Wire the ConfirmDialog to use it**

Current:
```tsx
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={`${confirmAction} record`}
        detail={
          isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')
            ? 'This calls the live requisitions API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); }}
      >
        {['Reject', 'Return for Revision'].includes(confirmAction ?? '') && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Remarks</span>
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 h-24 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.remarks && <span className="mt-1 block text-xs text-red-600">{errors.remarks}</span>}
          </label>
        )}
      </ConfirmDialog>
```
Replace with:
```tsx
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={`${confirmAction} record`}
        detail={
          (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) ||
          (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold'))
            ? 'This calls the live requisitions API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); }}
      >
        {(['Reject', 'Return for Revision'].includes(confirmAction ?? '') ||
          (isItAssetCustodianLiveFulfillment && confirmAction === 'On Hold')) && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Remarks</span>
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 h-24 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.remarks && <span className="mt-1 block text-xs text-red-600">{errors.remarks}</span>}
          </label>
        )}
      </ConfirmDialog>
```

- [x] **Step 6: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/prototype/WorkflowPage.tsx --max-warnings 0 && npm run test && npm run build
```
Expected: all clean/pass.

- [x] **Step 7: Manual check** (human, browser)

Log in as IT Personnel, go to `/it-asset-custodian/fulfillment`. Should show real pending-fulfillment requisitions (same ones visible via `/it-personnel/requisitions` on the old layout, filtered to `pending_fulfillment`). Open one, confirm the action list shows only "Fulfill" and "On Hold" (not "Reserve"). Fulfill one — refresh the page, confirm it's gone from the list (status changed) and the underlying asset's status updated (check via `/it-asset-custodian/assets/:id` or the old `/it-personnel/assets/:id`). Try "On Hold" on another — confirm it requires a reason, and that the requisition's status changes after confirming.

- [x] **Step 8: Commit**

```bash
git add Frontend/components/prototype/WorkflowPage.tsx
git commit -m "feat(it-asset-custodian): wire fulfillment queue to real requisitions API"
git push
```

---

### Task 6: Wire Custody & Issuance to real data

Real equivalent: asset lifecycle transitions via `assetsApi.updateLifecycle`. Unlike Fulfillment (Task 5), this slug's rows are ASSETS, not requisitions — the mock prototype's `rowsFor()` never actually had correct row logic for `custody` either (it silently fell through to a requisition-shaped catch-all), so this task both fixes that and makes it real in the same change. Also unlike Task 5, two of the three actions need real input fields (Issue needs an employee ID, Transfer needs a destination), not just an optional remarks box — this task generalizes the existing `ConfirmDialog` usage to support action-specific conditional fields, the same technique `AssetDetailManager` (Task 4) already uses for its own lifecycle modal, applied here instead of building a second, separate modal component.

**Files:**
- Modify: `Frontend/components/prototype/WorkflowPage.tsx`

**Interfaces:**
- Consumes: `assetsApi.list(page, limit)` → `Asset[]`, `assetsApi.updateLifecycle(id, { status, employeeId?, toLocation? })` (existing, `Frontend/lib/api/assets.ts`).

- [x] **Step 1: Add the `assetsApi`/`Asset` import**

Find the existing import block at the top of the file (near `import { auditApi, type AuditLog } from '@/lib/api/audit';` and `import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';`) and add, alphabetically ordered with the other `@/lib/api/*` imports:
```tsx
import { assetsApi, type Asset } from '@/lib/api/assets';
```

- [x] **Step 2: Extend `isLiveFetchPage`, add the custody flag, add new form-field state**

Find (this is Task 5's already-landed version):
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'fulfillment');
```
Replace with:
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && (normalizedSlug === 'fulfillment' || normalizedSlug === 'custody'));
```

Find `const isItAssetCustodianLiveFulfillment = ...` (added in Task 5) and add immediately after its statement:
```tsx
  const isItAssetCustodianLiveCustody =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'custody';
```

Find the block of `useState` declarations that includes `const [remarks, setRemarks] = useState('');` and add two new ones right after it:
```tsx
  const [issueEmployeeId, setIssueEmployeeId] = useState('');
  const [transferToLocation, setTransferToLocation] = useState('');
```

- [x] **Step 3: Add the asset row converter**

Find `function requisitionApiToRow(request: Requisition): Row {` and its closing `}`. Add this new function immediately after it (before `function auditApiToRow`):
```tsx
function assetApiToRow(asset: Asset): Row {
  return {
    id: asset.id,
    item: asset.itemDescription,
    serialNumber: asset.serialNumber,
    propertyNumber: asset.propertyNumber,
    status: asset.status,
    condition: asset.condition,
    location: asset.officeOrSection,
    custodianId: asset.custodianId ?? 'Unassigned',
  };
}
```

- [x] **Step 4: Extend `fetchLiveRows` with a custody branch**

Find (Task 5's already-landed version):
```tsx
  const fetchLiveRows = useCallback((): Promise<void> => {
    if (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') {
      return auditApi.list(1, LIVE_FETCH_LIMIT).then((res) => {
        setRows(res.data.data.map(auditApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
    const fetcher = normalizedSlug === 'fulfillment'
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT, 'pending_fulfillment')
      : normalizedSlug === 'approvals'
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT)
      : requisitionsApi.mine(1, LIVE_FETCH_LIMIT);
    return fetcher.then((res) => {
      setRows(res.data.data.map(requisitionApiToRow));
      setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
    });
  }, [normalizedSlug, role]);
```
Replace with:
```tsx
  const fetchLiveRows = useCallback((): Promise<void> => {
    if (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') {
      return auditApi.list(1, LIVE_FETCH_LIMIT).then((res) => {
        setRows(res.data.data.map(auditApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
    if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'custody') {
      return assetsApi.list(1, LIVE_FETCH_LIMIT).then((res) => {
        setRows(res.data.data.map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
    const fetcher = normalizedSlug === 'fulfillment'
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT, 'pending_fulfillment')
      : normalizedSlug === 'approvals'
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT)
      : requisitionsApi.mine(1, LIVE_FETCH_LIMIT);
    return fetcher.then((res) => {
      setRows(res.data.data.map(requisitionApiToRow));
      setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
    });
  }, [normalizedSlug, role]);
```
(This function's own `useCallback` dependency array — `[normalizedSlug, role]` — does not need to change; both new branches only read values already in that array.)

- [x] **Step 5: Add `submitCustodyDecision`**

Find the end of `submitFulfillmentDecision` (added in Task 5 — ends with a closing `};` followed by a blank line, then `const validateForm = () => {`). Insert this new function between them:
```tsx
  // Real, persisted counterpart to runAction for IT Asset Custodian's live custody
  // page — see isItAssetCustodianLiveCustody above. Calls the actual asset lifecycle
  // API instead of mutating local mock state. Unlike Fulfillment, two of the three
  // actions need a real input value, not just an optional remarks box.
  const submitCustodyDecision = async (action: 'Issue' | 'Transfer' | 'Return') => {
    if (!selected || actionSubmitting) return;
    if (action === 'Issue' && !issueEmployeeId.trim()) {
      setErrors({ employeeId: 'Employee ID is required to issue this asset.' });
      return;
    }
    if (action === 'Transfer' && !transferToLocation.trim()) {
      setErrors({ toLocation: 'Destination office or section is required.' });
      return;
    }
    setActionSubmitting(true);
    try {
      const id = String(selected.id);
      const statusForAction = { Issue: 'issued', Transfer: 'transferred', Return: 'returned' } as const;
      await assetsApi.updateLifecycle(id, {
        status: statusForAction[action],
        employeeId: action === 'Issue' ? issueEmployeeId.trim() : undefined,
        toLocation: action === 'Transfer' ? transferToLocation.trim() : undefined,
      });
      setConfirmAction(null);
      setSelected(null);
      setIssueEmployeeId('');
      setTransferToLocation('');
      setErrors({});
      const notifyMessage = { Issue: 'Asset issued.', Transfer: 'Asset transferred.', Return: 'Asset returned.' } as const;
      notify(notifyMessage[action]);
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch {
      notify(`Failed to complete this action. Please try again.`);
    } finally {
      setActionSubmitting(false);
    }
  };
```

- [x] **Step 6: Wire the ConfirmDialog — detail text, onConfirm, cancel reset, and the new conditional fields**

Find (this is Task 5's already-landed version — the `detail`/`onConfirm`/`onCancel` props):
```tsx
        detail={
          (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) ||
          (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold'))
            ? 'This calls the live requisitions API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); }}
      >
        {(['Reject', 'Return for Revision'].includes(confirmAction ?? '') ||
          (isItAssetCustodianLiveFulfillment && confirmAction === 'On Hold')) && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Remarks</span>
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 h-24 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.remarks && <span className="mt-1 block text-xs text-red-600">{errors.remarks}</span>}
          </label>
        )}
      </ConfirmDialog>
```
Replace with:
```tsx
        detail={
          (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) ||
          (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) ||
          (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return'))
            ? 'This calls the live requisitions API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) {
            void submitCustodyDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); setIssueEmployeeId(''); setTransferToLocation(''); }}
      >
        {(['Reject', 'Return for Revision'].includes(confirmAction ?? '') ||
          (isItAssetCustodianLiveFulfillment && confirmAction === 'On Hold')) && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Remarks</span>
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 h-24 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.remarks && <span className="mt-1 block text-xs text-red-600">{errors.remarks}</span>}
          </label>
        )}
        {isItAssetCustodianLiveCustody && confirmAction === 'Issue' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Recipient Employee ID</span>
            <input type="text" value={issueEmployeeId} onChange={(event) => setIssueEmployeeId(event.target.value)} placeholder="e.g. CICC-0042" className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.employeeId && <span className="mt-1 block text-xs text-red-600">{errors.employeeId}</span>}
          </label>
        )}
        {isItAssetCustodianLiveCustody && confirmAction === 'Transfer' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Receiving Office / Section</span>
            <input type="text" value={transferToLocation} onChange={(event) => setTransferToLocation(event.target.value)} placeholder="e.g. Cybercrime Operations Division" className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.toLocation && <span className="mt-1 block text-xs text-red-600">{errors.toLocation}</span>}
          </label>
        )}
      </ConfirmDialog>
```

- [x] **Step 7: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/prototype/WorkflowPage.tsx --max-warnings 0 && npm run test && npm run build
```
Expected: all clean/pass.

- [x] **Step 8: Manual check** (human, browser)

Log in as IT Personnel, go to `/it-asset-custodian/custody`. Should show real assets (not requisition-shaped mock rows). Open one that's `available`, choose "Issue", confirm the Employee ID field appears and is required (try submitting empty first, confirm the error shows), then issue it to a real employee ID (e.g. `CICC-0042` if that account exists, or any real employee's ID) — confirm success and that the asset's status updates after refresh. Try "Transfer" on another asset — confirm the destination field is required and works. Try "Return" on an issued asset — confirm it works with no extra field required.

- [x] **Step 9: Commit**

```bash
git add Frontend/components/prototype/WorkflowPage.tsx
git commit -m "feat(it-asset-custodian): wire custody & issuance to real asset lifecycle API"
git push
```

---

### Task 7: Wire Maintenance & Repair to real data

Real equivalent: this page shows assets ALREADY under repair (sending an asset TO repair already works today via `AssetDetailManager`'s own lifecycle modal from Task 4 — `available`/`issued` → `under_repair` is already a live transition there). This page's real job is the other half: resolve what's already under repair, either by marking it complete (`under_repair` → `available`) or recommending disposal instead (`under_repair` → `flagged_for_disposal`, notes required — CLAUDE.md's rule that any disposal flag needs documented justification applies regardless of which page triggers it). The mock `detailActions` for this slug (`['Mark Complete', 'Recommend Disposal']`) already matches this real shape exactly — no action-list change needed here, unlike Fulfillment's dropped `'Reserve'`.

This task also fixes the cosmetic copy issue flagged in Task 6's review: the shared `ConfirmDialog` `detail` text says "live requisitions API" for every OR-branch including the two asset-lifecycle ones (custody, and now maintenance) — fix the wording while touching this line again rather than as a separate task.

Reuses `assetApiToRow` (Task 6) unchanged — no new row converter needed.

**Files:**
- Modify: `Frontend/components/prototype/WorkflowPage.tsx`

**Interfaces:**
- Consumes: `assetsApi.list(page, limit, search?, status?)` with `status: 'under_repair'`, `assetsApi.updateLifecycle(id, { status, notes? })` (existing, `Frontend/lib/api/assets.ts`).

- [x] **Step 1: Extend `isLiveFetchPage`, add the maintenance flag**

Find (Task 6's already-landed version):
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && (normalizedSlug === 'fulfillment' || normalizedSlug === 'custody'));
```
Replace with:
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && (normalizedSlug === 'fulfillment' || normalizedSlug === 'custody' || normalizedSlug === 'maintenance'));
```

Find `const isItAssetCustodianLiveCustody = ...` (added in Task 6) and add immediately after its statement:
```tsx
  const isItAssetCustodianLiveMaintenance =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'maintenance';
```

- [x] **Step 2: Extend `fetchLiveRows` with a maintenance branch**

Find the custody branch added in Task 6 (inside `fetchLiveRows`, right after the audit branch):
```tsx
    if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'custody') {
      return assetsApi.list(1, LIVE_FETCH_LIMIT).then((res) => {
        setRows(res.data.data.map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
```
Add immediately after it (same shape, filtered to `under_repair`):
```tsx
    if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'maintenance') {
      return assetsApi.list(1, LIVE_FETCH_LIMIT, undefined, 'under_repair').then((res) => {
        setRows(res.data.data.map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
```

- [x] **Step 3: Add `submitMaintenanceDecision`**

Find the end of `submitCustodyDecision` (added in Task 6 — ends with a closing `};` followed by a blank line, then `const validateForm = () => {`). Insert this new function between them:
```tsx
  // Real, persisted counterpart to runAction for IT Asset Custodian's live maintenance
  // page — see isItAssetCustodianLiveMaintenance above. Reuses the existing remarks
  // state/textarea (required only for the disposal path, matching CLAUDE.md's
  // documented-justification rule for any disposal flag).
  const submitMaintenanceDecision = async (action: 'Mark Complete' | 'Recommend Disposal') => {
    if (!selected || actionSubmitting) return;
    const trimmedRemarks = remarks.trim();
    if (action === 'Recommend Disposal' && !trimmedRemarks) {
      setErrors({ remarks: 'A justification is required to recommend disposal.' });
      return;
    }
    setActionSubmitting(true);
    try {
      const id = String(selected.id);
      if (action === 'Mark Complete') {
        await assetsApi.updateLifecycle(id, { status: 'available' });
      } else {
        await assetsApi.updateLifecycle(id, { status: 'flagged_for_disposal', notes: trimmedRemarks });
      }
      setConfirmAction(null);
      setSelected(null);
      setRemarks('');
      setErrors({});
      notify(action === 'Mark Complete' ? 'Asset marked available.' : 'Disposal recommended.');
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch {
      notify('Failed to complete this action. Please try again.');
    } finally {
      setActionSubmitting(false);
    }
  };
```

- [x] **Step 4: Wire the ConfirmDialog — add the maintenance case, and fix the "requisitions API" copy while here**

Find (Task 6's already-landed version):
```tsx
        detail={
          (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) ||
          (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) ||
          (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return'))
            ? 'This calls the live requisitions API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) {
            void submitCustodyDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); setIssueEmployeeId(''); setTransferToLocation(''); }}
      >
        {(['Reject', 'Return for Revision'].includes(confirmAction ?? '') ||
          (isItAssetCustodianLiveFulfillment && confirmAction === 'On Hold')) && (
```
Replace with:
```tsx
        detail={
          (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) ||
          (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) ||
          (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) ||
          (isItAssetCustodianLiveMaintenance && (confirmAction === 'Mark Complete' || confirmAction === 'Recommend Disposal'))
            ? 'This calls the live backend API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) {
            void submitCustodyDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveMaintenance && (confirmAction === 'Mark Complete' || confirmAction === 'Recommend Disposal')) {
            void submitMaintenanceDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); setIssueEmployeeId(''); setTransferToLocation(''); }}
      >
        {(['Reject', 'Return for Revision'].includes(confirmAction ?? '') ||
          (isItAssetCustodianLiveFulfillment && confirmAction === 'On Hold') ||
          (isItAssetCustodianLiveMaintenance && confirmAction === 'Recommend Disposal')) && (
```
(Note: the copy fix changes "live requisitions API" to "live backend API" — accurate for all four cases now, not just requisitions-backed ones. Everything after this point in the file — the closing of the remarks label, the two custody field blocks, `</ConfirmDialog>` — stays exactly as Task 6 left it, not shown again here.)

- [x] **Step 5: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/prototype/WorkflowPage.tsx --max-warnings 0 && npm run test && npm run build
```
Expected: all clean/pass.

- [x] **Step 6: Manual check** (human, browser)

Log in as IT Personnel. First, on `/it-asset-custodian/assets/:id` (or the old `/it-personnel/assets/:id`), put a real asset under repair via its lifecycle modal (`available` → `under_repair`). Then go to `/it-asset-custodian/maintenance` — that asset should now appear in this list. Try "Mark Complete" — confirm it works and the asset disappears from this list (now `available`) after refresh. Put another asset under repair, then try "Recommend Disposal" on it from this page — confirm the justification field is required, and that after confirming, the asset now shows `flagged_for_disposal` status.

- [x] **Step 7: Commit**

```bash
git add Frontend/components/prototype/WorkflowPage.tsx
git commit -m "feat(it-asset-custodian): wire maintenance & repair to real asset lifecycle API"
git push
```

---

### Task 8: Wire Disposal Recommendations to real data

Real equivalent: the exact same transition Task 7's Maintenance page already performs for its own `'Recommend Disposal'` action (`assetsApi.updateLifecycle(id, { status: 'flagged_for_disposal', notes })`, notes required) — reachable from a separate page showing a different pool of candidate assets. Maintenance's disposal path targets what's already broken and under repair (`status: 'under_repair'`); this page's job is different in kind, not just location — flagging assets that still work but are old/obsolete/no-longer-needed, so it fetches `status: 'available'` assets instead. Because the action itself is identical to Task 7's, this task reuses `submitMaintenanceDecision('Recommend Disposal')` directly — no new submit function, no new row converter (`assetApiToRow` again). `detailActions` for this slug already returns exactly `['Recommend Disposal']` for IT_ASSET_CUSTODIAN (the `role === PROPERTY_OFFICER` branch is untouched, out of scope — Property Officer is Phase 4) — no signature or branch change needed there either.

**Files:**
- Modify: `Frontend/components/prototype/WorkflowPage.tsx`

**Interfaces:**
- Consumes: `assetsApi.list(page, limit, search?, status?)` with `status: 'available'` (existing), `submitMaintenanceDecision` (added in Task 7, reused unchanged).

- [x] **Step 1: Extend `isLiveFetchPage`, add the disposal flag**

Find (Task 7's already-landed version):
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && (normalizedSlug === 'fulfillment' || normalizedSlug === 'custody' || normalizedSlug === 'maintenance'));
```
Replace with:
```tsx
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && (normalizedSlug === 'fulfillment' || normalizedSlug === 'custody' || normalizedSlug === 'maintenance' || normalizedSlug === 'disposal'));
```

Find `const isItAssetCustodianLiveMaintenance = ...` (added in Task 7) and add immediately after its statement:
```tsx
  const isItAssetCustodianLiveDisposal =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'disposal';
```

- [x] **Step 2: Extend `fetchLiveRows` with a disposal branch**

Find the maintenance branch added in Task 7 (inside `fetchLiveRows`, right after the custody branch):
```tsx
    if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'maintenance') {
      return assetsApi.list(1, LIVE_FETCH_LIMIT, undefined, 'under_repair').then((res) => {
        setRows(res.data.data.map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
```
Add immediately after it (same shape, filtered to `available` instead):
```tsx
    if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'disposal') {
      return assetsApi.list(1, LIVE_FETCH_LIMIT, undefined, 'available').then((res) => {
        setRows(res.data.data.map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
```

- [x] **Step 3: Wire the ConfirmDialog — reuse `submitMaintenanceDecision`, no new function**

Find (Task 7's already-landed version — the `detail`/`onConfirm`/remarks-required condition):
```tsx
        detail={
          (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) ||
          (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) ||
          (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) ||
          (isItAssetCustodianLiveMaintenance && (confirmAction === 'Mark Complete' || confirmAction === 'Recommend Disposal'))
            ? 'This calls the live backend API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) {
            void submitCustodyDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveMaintenance && (confirmAction === 'Mark Complete' || confirmAction === 'Recommend Disposal')) {
            void submitMaintenanceDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); setIssueEmployeeId(''); setTransferToLocation(''); }}
      >
        {(['Reject', 'Return for Revision'].includes(confirmAction ?? '') ||
          (isItAssetCustodianLiveFulfillment && confirmAction === 'On Hold') ||
          (isItAssetCustodianLiveMaintenance && confirmAction === 'Recommend Disposal')) && (
```
Replace with:
```tsx
        detail={
          (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) ||
          (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) ||
          (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) ||
          (isItAssetCustodianLiveMaintenance && (confirmAction === 'Mark Complete' || confirmAction === 'Recommend Disposal')) ||
          (isItAssetCustodianLiveDisposal && confirmAction === 'Recommend Disposal')
            ? 'This calls the live backend API and updates the real record.'
            : 'This updates frontend mock state only. Backend authorization and persistence will be implemented later.'
        }
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovingOfficerLiveApprovals && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveFulfillment && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveCustody && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) {
            void submitCustodyDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveMaintenance && (confirmAction === 'Mark Complete' || confirmAction === 'Recommend Disposal')) {
            void submitMaintenanceDecision(confirmAction);
            return;
          }
          if (isItAssetCustodianLiveDisposal && confirmAction === 'Recommend Disposal') {
            void submitMaintenanceDecision(confirmAction);
            return;
          }
          runAction(confirmAction);
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); setIssueEmployeeId(''); setTransferToLocation(''); }}
      >
        {(['Reject', 'Return for Revision'].includes(confirmAction ?? '') ||
          (isItAssetCustodianLiveFulfillment && confirmAction === 'On Hold') ||
          (isItAssetCustodianLiveMaintenance && confirmAction === 'Recommend Disposal') ||
          (isItAssetCustodianLiveDisposal && confirmAction === 'Recommend Disposal')) && (
```
(`submitMaintenanceDecision` accepts `'Mark Complete' | 'Recommend Disposal'` — calling it with `confirmAction` narrowed to exactly `'Recommend Disposal'` in the new disposal branch satisfies that type correctly, it's a subset of the accepted union.)

- [x] **Step 4: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/prototype/WorkflowPage.tsx --max-warnings 0 && npm run test && npm run build
```
Expected: all clean/pass.

- [x] **Step 5: Manual check** (human, browser)

Log in as IT Personnel, go to `/it-asset-custodian/disposal`. Should show real `available`-status assets (not ones under repair — those are on the Maintenance page instead). Open one, recommend it for disposal — confirm the justification field is required, and that after confirming, the asset's status becomes `flagged_for_disposal` (check via its detail page). Confirm the Maintenance page (Task 7) and this page show different, non-overlapping asset lists (one `under_repair`, one `available`).

- [x] **Step 6: Commit**

```bash
git add Frontend/components/prototype/WorkflowPage.tsx
git commit -m "feat(it-asset-custodian): wire disposal recommendations to real asset lifecycle API"
git push
```

---

**Phase 1 complete once Task 8 lands and reviews clean.** At that point, all of IT Asset Custodian's pages (dashboard, notifications, QR lookup, asset registry, fulfillment, custody, maintenance, disposal) are genuinely wired to the real backend — reports/forms already work via the existing `/it-personnel/forms` and `/it-personnel/reports` real pages (out of scope for this phase, already real, just not yet ported into the new layout's `reports` slug — a natural candidate for a Phase 1.5 or folded into Phase 2's report-tab work, not decided here).

---

## Phase 2: Approving Officer's Dashboard — ✅ COMPLETE (2026-08-22)

Task 9 implemented, reviewed clean, pushed. See the ledger
(`.superpowers/sdd/2026-08-22-port-real-wiring-to-new-layout/progress.md`)
for the full account. Manual browser verification (Step 4 below) is still
the user's to do.

**Scope note (found while expanding this phase):** the old layout's own reference
implementation (`Frontend/app/supervisor/dashboard/page.tsx`) shows `requisitionsApi.stats()`'s
`approved`/`rejected`/`pending` fields under labels ("Pending Review", "Approved", "Rejected")
that read as *approval-decision* counts. They aren't. `RequisitionsService.getStats()`
(`Backend/src/requisitions/requisitions.service.ts:159-161`) scopes SUPERVISOR the same as
EMPLOYEE — `WHERE requestedById = :userId` — so for this role every number in that response
describes requisitions **the supervisor personally submitted** (Supervisors can submit their
own requisitions too, per the role matrix), not requisitions routed to them for a decision.
This is confirmed intentional, not a bug to fix: the service's own comment says "personal
requisition status overview," and an existing test
(`Backend/src/requisitions/requisitions.service.spec.ts:746`, `'scopes supervisor stats to
their own requests'`) locks in exactly this scoping. Porting the old dashboard's labels
verbatim would carry a real, pre-existing mislabeling into the new layout, so Task 9 below
does not reuse those three fields under approval-flavored names. The one number this role
*can* trust for its primary job is "how many requisitions are routed to me for a decision
right now" — `RequisitionsService.findAll()`'s SUPERVISOR branch
(`requisitions.service.ts:74-78`) hard-scopes that to `supervisorId = :id AND status =
'pending_supervisor'`, which is exactly the same query the already-live `/approving-officer/approvals`
page (`isApprovingOfficerLiveApprovals`, existing code, untouched by this task) already uses.
No backend change needed — this task only changes what the frontend fetches and how it's
labeled.

### Task 9: Wire the Approving Officer Dashboard to real data

**Files:**
- Create: `Frontend/components/approving-officer/ApprovingOfficerDashboard.tsx`
- Modify: `Frontend/app/approving-officer/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `requisitionsApi.list(1, 15, 'pending_supervisor')` → `PaginatedResponse<Requisition>` (`Frontend/lib/api/requisitions.ts` — same call the live `/approving-officer/approvals` page already makes), `requisitionsApi.stats()` → `RequisitionStats` (`{ total, pending, approved, rejected, fulfilled, onHold }`, honestly labeled here as the caller's own submitted-requisition total per the scope note above — only `.total` is used), `notificationsApi.list()` → `{ notifications, unreadCount }` (`Frontend/lib/api/notifications.ts`), `useAuth()` → `{ user }` (`Frontend/lib/auth/use-auth.ts`).
- Produces: `ApprovingOfficerDashboard` (no props) — rendered directly by the router for `segment === 'dashboard'`.

- [x] **Step 1: Write the component**

```tsx
// Frontend/components/approving-officer/ApprovingOfficerDashboard.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClipboardCheck, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { requisitionsApi, type Requisition, type RequisitionStats } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export function ApprovingOfficerDashboard() {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<Requisition[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [stats, setStats] = useState<RequisitionStats | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      requisitionsApi.list(1, 15, 'pending_supervisor'),
      requisitionsApi.stats(),
      notificationsApi.list(),
    ])
      .then(([pendingRes, statsRes, notifRes]) => {
        if (cancelled) return;
        setPendingApprovals(pendingRes.data.data);
        setPendingTotal(pendingRes.data.total);
        setStats(statsRes.data);
        setUnreadCount(notifRes.data.unreadCount);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load dashboard data. Please refresh the page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Approving Officer</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950">Good day, {user?.firstName ?? 'there'}</h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/approving-officer/approvals" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><ClipboardCheck className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Pending my approval</span><span className="text-2xl font-extrabold text-slate-950">{pendingTotal}</span></span>
        </Link>
        <Link href="/approving-officer/requisitions" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><ClipboardList className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">My own requisitions</span><span className="text-2xl font-extrabold text-slate-950">{stats?.total ?? 0}</span></span>
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h2 className="text-[15px] font-extrabold text-slate-950">Awaiting My Approval</h2>
        </div>
        {pendingApprovals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Nothing awaiting your approval right now.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingApprovals.slice(0, 6).map((req) => (
              <Link key={req.id} href="/approving-officer/approvals" className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50">
                <span className="text-sm font-bold text-slate-950">{req.items[0]?.itemDescription ?? 'Requisition'}</span>
                <span className="text-xs text-slate-500">{req.requestNumber}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Unread notifications: {unreadCount} — <Link href="/approving-officer/notifications" className="font-bold text-blue-700 hover:underline">view all</Link>
      </p>
    </div>
  );
}
```

- [x] **Step 2: Wire it into the router**

Current file:
```tsx
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ApprovingOfficerPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.APPROVING_OFFICER} />;
  return <WorkflowPage role={ProposedUserRole.APPROVING_OFFICER} slug={segment} />;
}
```

Replace with:
```tsx
import { ApprovingOfficerDashboard } from '@/components/approving-officer/ApprovingOfficerDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ApprovingOfficerPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <ApprovingOfficerDashboard />;
  return <WorkflowPage role={ProposedUserRole.APPROVING_OFFICER} slug={segment} />;
}
```
(`RoleDashboard` is used nowhere else in this file — remove its import entirely, same as Task 2 did for IT Asset Custodian's router.)

- [x] **Step 3: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/approving-officer/ApprovingOfficerDashboard.tsx "app/approving-officer/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all four clean/succeed.

- [x] **Step 4: Manual check** (human, browser)

Log in as Supervisor (`supervisor@cicc.gov.ph` / `Supervisor@CICC2026!` — same backend role as Approving Officer, per `docs/guides/ROLES.md`). Land on `/approving-officer/dashboard`. "Pending my approval" should match the count on `/approving-officer/approvals` (both read the same live query). "My own requisitions" should match what you see if that same account has ever submitted a requisition of its own (via `/approving-officer/requisitions`, which is separately already live). Clicking either KPI card, a queue row, or "view all" notifications navigates correctly.

- [x] **Step 5: Commit**

```bash
git add Frontend/components/approving-officer/ApprovingOfficerDashboard.tsx "Frontend/app/approving-officer/[[...slug]]/page.tsx"
git commit -m "feat(approving-officer): wire dashboard to real requisition/notification data"
git push
```

---

## Phase 3: Management & Audit Viewer's remaining report tabs — ✅ COMPLETE (2026-08-22)

Tasks 10-11 implemented, reviewed clean (1 minor deferred — see the ledger),
pushed. Manual browser verification (Step 4 of each task below) is still
the user's to do.

**Scope investigation (found while expanding this phase):**
- `reportsApi.generate()` (`POST /v1/reports/generate`) is authorized for `UserRole.MANAGEMENT` on the backend (`Backend/src/reports/reports.controller.ts:110-117`) and already has a real, working frontend flow: `Frontend/components/shared/ReportsContent.tsx` (fixed 2026-08-21, currently used unfiltered by `/it-personnel/reports` and `/management/reports`). It offers 6 report types across all categories in one page. The new layout splits these into 4 separate category tabs — `asset-reports`, `requisition-reports`, `maintenance-disposal`, `physical-count` — so Task 10 parameterizes `ReportsContent` with an optional report-type filter instead of writing 4 near-duplicate components.
- **`physical-count` is in scope, not excluded** — re-examined against the spec's actual non-goal wording. The non-goal excludes the *reconciliation workflow* (scan sessions, comparing counts, `Property Officer`'s `reconciliation`/`corrections` pages, `physical-inventory` pages) because no backend mechanism exists to record or compare a count. Generating the "Physical Count Summary" *report* is a different, already-real capability — `PHYSICAL_COUNT` is one of `ReportsContent`'s existing 6 report types, calling the same real `/v1/reports/generate` endpoint as the other 5. `SYSTEM-STATUS.md` separately documents that this report's *contents* are thin (a plain asset listing, no actual count/reconciliation logic) — that's a pre-existing business-logic gap in the report itself, not a reason to withhold the working generate-and-download action from this phase. Porting it is honest: it downloads a real PDF/Excel file with real data, the same as the other three tabs.
- **`forms` (Forms Archive) is real, but read-only-only, matching this role's RBAC.** `GET /v1/reports/forms` (list) and `GET /v1/reports/forms/:id/download` both authorize `UserRole.MANAGEMENT` (`reports.controller.ts:81-92`, `:149-156`) — browsing and re-downloading previously generated COA forms is safe to port. `POST /v1/reports/forms/generate` (creating a *new* form) does **not** authorize `MANAGEMENT` (`reports.controller.ts:178-184`, only `IT_PERSONNEL`/`SYSTEM_ADMIN`/`PROPERTY_CUSTODIAN`) — matching CLAUDE.md's role matrix, where "Generate official forms" is not a Management permission. Task 11 therefore extracts only the read-only "previously generated forms" half of the old layout's `Frontend/app/it-personnel/forms/page.tsx` (its `history`/`fetchHistory`/`handleRedownload` logic) into a new component — the form-*generation* UI on that same old page is deliberately not ported to this role at all.
- **`audit` is already live** (existing `isLiveFetchPage` code from before this session, untouched) — no task needed.
- **`dashboard` stays out of scope for this phase** — not named in the spec's Phase 3 list, remains the shared mock `RoleDashboard` for now.
- No backend changes in this phase — every endpoint used already authorizes `MANAGEMENT` today.

### Task 10: Wire the 4 report-category tabs to the real report-generation API

**Files:**
- Modify: `Frontend/components/shared/ReportsContent.tsx`
- Modify: `Frontend/app/management-audit/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `reportsApi.generate(dto)` → `Blob` (`Frontend/lib/api/reports.ts`, unchanged).
- Produces: `ReportsContent` gains two new optional props, `reportTypes?: string[]` and `pageTitle?: string`/`panelTitle?: string` — omitting all three preserves today's exact behavior (all 6 report types, "Generate Reports" / "Management Reports" headings), so the two existing callers (`Frontend/app/it-personnel/reports/page.tsx`, `Frontend/app/management/reports/page.tsx`) need no changes and keep working identically.

- [x] **Step 1: Parameterize `ReportsContent`**

Current file:
```tsx
'use client';

import { useState } from 'react';
import { BarChart2, Download } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';

const REPORT_TYPES = [
  { value: 'ASSET_MASTER_LIST', label: 'Asset Master List', formats: ['pdf', 'excel'] as const },
  { value: 'REQUISITION_HISTORY', label: 'Requisition History Log', formats: ['pdf', 'excel'] as const },
  { value: 'ASSET_ISSUANCE', label: 'Asset Issuance Record', formats: ['pdf'] as const },
  { value: 'ASSET_RETURN', label: 'Asset Return Record', formats: ['pdf'] as const },
  { value: 'PHYSICAL_COUNT', label: 'Physical Count Summary', formats: ['pdf', 'excel'] as const },
  { value: 'DISPOSAL', label: 'Disposal Documentation Report', formats: ['pdf'] as const },
];

export function ReportsContent() {
  const [selectedReport, setSelectedReport] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const currentReport = REPORT_TYPES.find((r) => r.value === selectedReport);
```

Replace the top of the file (everything up to and including the `currentReport` line) with:
```tsx
'use client';

import { useState } from 'react';
import { BarChart2, Download } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';

const ALL_REPORT_TYPES = [
  { value: 'ASSET_MASTER_LIST', label: 'Asset Master List', formats: ['pdf', 'excel'] as const },
  { value: 'REQUISITION_HISTORY', label: 'Requisition History Log', formats: ['pdf', 'excel'] as const },
  { value: 'ASSET_ISSUANCE', label: 'Asset Issuance Record', formats: ['pdf'] as const },
  { value: 'ASSET_RETURN', label: 'Asset Return Record', formats: ['pdf'] as const },
  { value: 'PHYSICAL_COUNT', label: 'Physical Count Summary', formats: ['pdf', 'excel'] as const },
  { value: 'DISPOSAL', label: 'Disposal Documentation Report', formats: ['pdf'] as const },
];

export function ReportsContent({
  reportTypes,
  pageTitle = 'Generate Reports',
  panelTitle = 'Management Reports',
}: Readonly<{ reportTypes?: string[]; pageTitle?: string; panelTitle?: string }>) {
  const REPORT_TYPES = reportTypes ? ALL_REPORT_TYPES.filter((r) => reportTypes.includes(r.value)) : ALL_REPORT_TYPES;
  const [selectedReport, setSelectedReport] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const currentReport = REPORT_TYPES.find((r) => r.value === selectedReport);
```

Leave `handleGenerate` exactly as it is (it already reads `selectedReport`/`format`/`currentReport`, all still in scope — no changes needed there).

Then, further down in the same file, find:
```tsx
      <PageHeader title="Generate Reports" />
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">Management Reports</h2>
        </div>
```
Replace with:
```tsx
      <PageHeader title={pageTitle} />
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-[#1a4d7a]" />
          <h2 className="text-base font-semibold text-[#1a4d7a]">{panelTitle}</h2>
        </div>
```
The rest of the file (the `<form>` body, the report-type/format radio lists, the submit button) is unchanged — it already reads from the local `REPORT_TYPES`/`currentReport` names, which still resolve correctly since the new local `const REPORT_TYPES = ...` line shadows the old module-level constant with the same name.

- [x] **Step 2: Add the 4 new router branches**

Current file:
```tsx
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ManagementAuditPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} />;
  return <WorkflowPage role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} slug={segment} />;
}
```

Replace with:
```tsx
import { ReportsContent } from '@/components/shared/ReportsContent';
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function ManagementAuditPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} />;
  if (segment === 'asset-reports') return <ReportsContent reportTypes={['ASSET_MASTER_LIST', 'ASSET_ISSUANCE', 'ASSET_RETURN']} pageTitle="Asset Reports" panelTitle="Asset Reports" />;
  if (segment === 'requisition-reports') return <ReportsContent reportTypes={['REQUISITION_HISTORY']} pageTitle="Requisition Reports" panelTitle="Requisition Reports" />;
  if (segment === 'maintenance-disposal') return <ReportsContent reportTypes={['DISPOSAL']} pageTitle="Maintenance & Disposal Reports" panelTitle="Disposal Documentation" />;
  if (segment === 'physical-count') return <ReportsContent reportTypes={['PHYSICAL_COUNT']} pageTitle="Physical Count Reports" panelTitle="Physical Count Summary" />;
  return <WorkflowPage role={ProposedUserRole.MANAGEMENT_AUDIT_VIEWER} slug={segment} />;
}
```
(No separate "maintenance" report exists among the real 6 report types — `maintenance-disposal`'s tab offers only `DISPOSAL`, the one real report in that category. This is intentional, matching Task 9's precedent of not fabricating data that doesn't exist — do not add a placeholder maintenance report type.)

- [x] **Step 3: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/shared/ReportsContent.tsx "app/management-audit/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all four clean/succeed.

- [x] **Step 4: Manual check** (human, browser)

Log in as Management (`management@cicc.gov.ph` / `Management@CICC2026!`, per `docs/guides/ROLES.md`). Visit each of `/management-audit/asset-reports`, `/requisition-reports`, `/maintenance-disposal`, `/physical-count` — each should show only its own report type(s) (3, 1, 1, 1 respectively), generate and download a real file when clicked, and show the same success/error messaging as `/management/reports` already does. Then separately verify `/it-personnel/reports` and `/management/reports` (the two existing callers) still show all 6 report types exactly as before — this step is the regression check that the new optional props didn't change default behavior.

- [x] **Step 5: Commit**

```bash
git add Frontend/components/shared/ReportsContent.tsx "Frontend/app/management-audit/[[...slug]]/page.tsx"
git commit -m "feat(management-audit): wire the 4 report-category tabs to the real report-generation API"
git push
```

---

### Task 11: Wire the Forms Archive tab to the real forms-history API

**Files:**
- Create: `Frontend/components/shared/FormsArchiveContent.tsx`
- Modify: `Frontend/app/management-audit/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `reportsApi.forms(1, 50)` → `PaginatedResponse<FormMeta>` (`Frontend/lib/api/reports.ts`), `reportsApi.downloadStoredForm(id)` → `Blob`.
- Produces: `FormsArchiveContent` (no props) — rendered directly by the router for `segment === 'forms'`.

- [x] **Step 1: Write the component**

```tsx
// Frontend/components/shared/FormsArchiveContent.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Clock, Download, RefreshCw } from 'lucide-react';
import { reportsApi, type FormMeta } from '@/lib/api/reports';
import { PageHeader } from '@/components/ui/PageHeader';

export function FormsArchiveContent() {
  const [history, setHistory] = useState<FormMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(() => {
    reportsApi
      .forms(1, 50)
      .then((r) => {
        setHistory(r.data.data);
        setError('');
      })
      .catch(() => setError('Failed to load the forms archive. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setLoading(true);
    fetchHistory();
  };

  const handleDownload = async (form: FormMeta) => {
    setDownloadingId(form.id);
    try {
      const blob = await reportsApi.downloadStoredForm(form.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.formType}-${form.generatedAt.slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail -- old records before this feature won't have a stored PDF
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Forms Archive" />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#1a4d7a]" />
            <h2 className="text-base font-semibold text-[#1a4d7a]">Generated COA / CICC Forms</h2>
          </div>
          <button type="button" onClick={handleRefresh} className="flex items-center gap-1.5 text-xs text-[#1a4d7a] hover:text-[#143d61] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading archive…</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No forms have been generated yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((form) => (
              <div key={form.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800">{form.formType}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <Clock className="inline w-3 h-3 mr-1 -mt-0.5" />
                    {new Date(form.generatedAt).toLocaleString('en-PH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {form.relatedAssetId && (
                      <span className="ml-2 text-gray-300">· asset {form.relatedAssetId.slice(0, 8)}…</span>
                    )}
                    {form.relatedRequisitionId && (
                      <span className="ml-2 text-gray-300">· req {form.relatedRequisitionId.slice(0, 8)}…</span>
                    )}
                  </p>
                </div>
                <button type="button"
                  onClick={() => handleDownload(form)}
                  disabled={downloadingId === form.id || form.filePath !== 'stored'}
                  title={form.filePath !== 'stored' ? 'PDF not stored — regenerate from IT Personnel or Property Custodian' : 'Download stored PDF'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#1a4d7a] border border-[#1a4d7a]/30 rounded-md hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingId === form.id ? 'Downloading…' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Wire it into the router**

In `Frontend/app/management-audit/[[...slug]]/page.tsx` (as left by Task 10), add the import and one new branch:
```tsx
import { FormsArchiveContent } from '@/components/shared/FormsArchiveContent';
```
```tsx
  if (segment === 'forms') return <FormsArchiveContent />;
```
Place it directly after the `physical-count` branch and before the final `WorkflowPage` fallback.

- [x] **Step 3: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/shared/FormsArchiveContent.tsx "app/management-audit/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all four clean/succeed.

- [x] **Step 4: Manual check** (human, browser)

Log in as Management. Visit `/management-audit/forms` — it should list previously generated COA forms (generate a couple first as IT Personnel at `/it-personnel/forms` if the list is empty) with working "Download" buttons, and show no way to generate a *new* form from this page (no form-type picker, no "Generate" button) — that action correctly stays IT-Personnel/Property-Custodian-only per RBAC.

- [x] **Step 5: Commit**

```bash
git add Frontend/components/shared/FormsArchiveContent.tsx "Frontend/app/management-audit/[[...slug]]/page.tsx"
git commit -m "feat(management-audit): wire the Forms Archive tab to the real forms-history API"
git push
```

---

## Phase 4: Property Custodian / Property Officer asset pages

**Scope investigation (found while expanding this phase):** both roles share the
same backend asset-type scope, `[Fixed, Supplies]`
(`Backend/src/common/utils/asset-type-scope.util.ts:11-13`). Property
*Officer*'s new-layout nav has one unified `/property-officer/assets` route —
same shape as IT Asset Custodian's Phase 1 Task 4, directly reusable, no
backend change needed. Property *Custodian*'s nav instead splits the registry
into two separate pages, "Fixed Asset Registry" (`/property-custodian/fixed-assets`)
and "Supply Inventory" (`/property-custodian/supplies`) — but `GET /v1/assets`
has no per-request asset-type filter, only the role's full authorized set in
one call, so there was no way to make those two tabs show genuinely different,
correctly-paginated content without a backend change. **Presented to the user
as a decision point; approved: add a small, defensive `assetType` filter to
`GET /v1/assets`** (Task 12) that only *narrows* within a role's
already-authorized scope — it can never widen it (a Property role requesting
`ICT` is rejected, not silently ignored). Task 13 then wires both split tabs
using it. QR Scanner and the disposal/fulfillment/custody pages don't need
this filter at all (they already work on the full authorized set, same as
Phase 1) — see the per-task notes below for why.

Also found: `AssetType` enum values are **not** lowercase snake_case, unlike
every other enum in this codebase — `packages/shared/src/enums/index.ts:19-23`
defines `ICT = 'ICT'`, `FIXED = 'Fixed'`, `SUPPLIES = 'Supplies'`. Every task
below that sends or filters by asset type uses these exact values verbatim.
Do not "correct" them to lowercase — that would be the bug, not the fix, for
this one enum specifically.

Reconciliation, replacement-validation, and disposal-*review* pages (Property
Officer's "Inventory Corrections"/"Reconciliation"/"Replacement Validation")
are excluded per the spec's non-goals and stay mock. Property Officer's
"Disposal Review" (Approve/Reject/Return-for-Revision on a flagged asset) and
"Audit History" (a full log browse) are also excluded from this phase — no
backend endpoint exists for either (disposal only has a one-way
`flagged_for_disposal → disposed` transition, no approve/reject step; `GET
/v1/audit`, the full log, authorizes only System Admin and Management, not
Property Officer — confirmed in `Backend/src/audit/audit.controller.ts:29-30`).
Both stay mock, same as today.

### Task 12: Add a defensive `assetType` filter to `GET /v1/assets`

**Files:**
- Modify: `Backend/src/assets/assets.service.ts`
- Modify: `Backend/src/assets/assets.controller.ts`
- Modify: `Backend/src/assets/assets.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AssetsService.findAll()` gains a 6th optional parameter,
  `requestedAssetType?: string` — narrows the existing `assetTypeScope` param
  to a single type, but only if that type is already within the caller's
  authorized scope (or the caller is unscoped, e.g. System Admin/Management).
  `GET /v1/assets` gains an optional `assetType` query string with the same
  narrowing behavior. Omitting it reproduces today's exact behavior — every
  existing caller (all of Phase 1's `assetsApi.list()` call sites) is
  unaffected.

- [ ] **Step 1: Modify `AssetsService.findAll()`**

Current method (`Backend/src/assets/assets.service.ts`, inside the class,
right after the JSDoc-style section comments):
```ts
  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    status?: string,
    assetTypeScope?: AssetType[],
  ) {
    const qb = this.assetRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (assetTypeScope && assetTypeScope.length > 0) {
      qb.andWhere('a.assetType IN (:...assetTypeScope)', { assetTypeScope });
    }

    if (status) {
      qb.andWhere('a.status = :status', { status: status.toLowerCase() });
    }

    if (search) {
      const q = `%${search}%`;
      qb.andWhere(
        '(LOWER(a.itemDescription) LIKE LOWER(:q) OR LOWER(a.propertyNumber) LIKE LOWER(:q) OR LOWER(a.serialNumber) LIKE LOWER(:q) OR LOWER(a.brand) LIKE LOWER(:q))',
        { q },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
```

Replace with:
```ts
  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    status?: string,
    assetTypeScope?: AssetType[],
    requestedAssetType?: string,
  ) {
    // Narrow within the caller's already-authorized scope only — never widen
    // it. Property Custodian's UI splits Fixed and Supplies into separate
    // list tabs; this lets either tab ask for just its own subtype. Reassigns
    // the existing `assetTypeScope` param in place so the WHERE-clause
    // construction below (and every test already covering it) needs zero
    // changes.
    if (requestedAssetType) {
      if (!Object.values(AssetType).includes(requestedAssetType as AssetType)) {
        throw new BadRequestException('Invalid assetType filter.');
      }
      if (
        assetTypeScope &&
        !assetTypeScope.includes(requestedAssetType as AssetType)
      ) {
        throw new ForbiddenException('Not authorized for this asset type.');
      }
      assetTypeScope = [requestedAssetType as AssetType];
    }

    const qb = this.assetRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (assetTypeScope && assetTypeScope.length > 0) {
      qb.andWhere('a.assetType IN (:...assetTypeScope)', { assetTypeScope });
    }

    if (status) {
      qb.andWhere('a.status = :status', { status: status.toLowerCase() });
    }

    if (search) {
      const q = `%${search}%`;
      qb.andWhere(
        '(LOWER(a.itemDescription) LIKE LOWER(:q) OR LOWER(a.propertyNumber) LIKE LOWER(:q) OR LOWER(a.serialNumber) LIKE LOWER(:q) OR LOWER(a.brand) LIKE LOWER(:q))',
        { q },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
```
(`BadRequestException`, `ForbiddenException`, and `AssetType` are already
imported at the top of this file — no new imports needed.)

- [ ] **Step 2: Modify the controller to accept and pass through the new query param**

Current (`Backend/src/assets/assets.controller.ts`):
```ts
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const assetTypeScope = req
      ? resolveAssetTypeScope(req.user.role)
      : undefined;
    const result = await this.assetsService.findAll(
      +page,
      +limit,
      search,
      status,
      assetTypeScope,
    );
    return { message: 'Assets retrieved successfully', data: result };
  }
```

Replace with:
```ts
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('assetType') assetType?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const assetTypeScope = req
      ? resolveAssetTypeScope(req.user.role)
      : undefined;
    const result = await this.assetsService.findAll(
      +page,
      +limit,
      search,
      status,
      assetTypeScope,
      assetType,
    );
    return { message: 'Assets retrieved successfully', data: result };
  }
```

- [ ] **Step 3: Add tests**

In `Backend/src/assets/assets.service.spec.ts`, inside the existing
`describe('findAll()', ...)` block (find the last test in that block —
`'does not add an assetType filter when assetTypeScope is undefined'` — and
insert these three new tests directly after it, before the block's closing
`});`):
```ts
    it('narrows to the requested type when it is within the authorized scope', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(
        1,
        20,
        undefined,
        undefined,
        [AssetType.FIXED, AssetType.SUPPLIES],
        AssetType.FIXED,
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'a.assetType IN (:...assetTypeScope)',
        { assetTypeScope: [AssetType.FIXED] },
      );
    });

    it('rejects a requested type outside the authorized scope', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(
        service.findAll(
          1,
          20,
          undefined,
          undefined,
          [AssetType.FIXED, AssetType.SUPPLIES],
          AssetType.ICT,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a requested type that is not a real AssetType value', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(
        service.findAll(1, 20, undefined, undefined, undefined, 'not-a-type'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows an unscoped role (e.g. System Admin) to request any single real type', async () => {
      const qb = makeQb();
      mockAssetRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(
        1,
        20,
        undefined,
        undefined,
        undefined,
        AssetType.SUPPLIES,
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'a.assetType IN (:...assetTypeScope)',
        { assetTypeScope: [AssetType.SUPPLIES] },
      );
    });
```
(`ForbiddenException`, `BadRequestException`, and `AssetType` are already
imported at the top of this spec file, lines 3-20 — no new imports needed.)

- [ ] **Step 4: Verify**

```bash
cd Backend && npx tsc --noEmit && npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0 && npm run build && npm run test
```
Expected: all four clean/succeed. Confirm the test summary shows 4 new
passing tests (0 failed) in addition to every pre-existing `findAll()` test.

- [ ] **Step 5: Manual check** (human, browser or API client)

Not browser-visible on its own (no frontend consumes this yet — Task 13
does). Optional: with a valid Property Custodian JWT, `GET
/api/v1/assets?assetType=Fixed` should return only Fixed assets;
`GET /api/v1/assets?assetType=ICT` should return `403 Forbidden`;
`GET /api/v1/assets?assetType=bogus` should return `400 Bad Request`;
`GET /api/v1/assets` (no param) should return the same combined
Fixed+Supplies result as before this change.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/assets/assets.service.ts Backend/src/assets/assets.controller.ts Backend/src/assets/assets.service.spec.ts
git commit -m "feat(assets): add a role-scoped assetType filter to GET /v1/assets"
git push
```

---

### Task 13: Wire Property Custodian's Fixed Asset Registry and Supply Inventory tabs

**Files:**
- Modify: `Frontend/lib/api/assets.ts`
- Modify: `Frontend/components/assets/AssetRegistryList.tsx`
- Modify: `Frontend/app/property-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `assetsApi.list()` gains a 5th optional parameter, `assetType?: string` (Task 12's new query param) — omitting it preserves every existing call site's current behavior.
- Produces: `AssetRegistryList` gains two new optional props, `assetType?: string` and `title?: string` (default `'Asset Inventory'`, matching today's hardcoded value) — the existing IT Asset Custodian call site (`<AssetRegistryList basePath="/it-asset-custodian/assets" />`) needs no changes.

- [ ] **Step 1: Add the `assetType` param to the API client**

In `Frontend/lib/api/assets.ts`, find:
```ts
  list: (page = 1, limit = 15, search?: string, status?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;
    return client.get<ApiResponse<PaginatedResponse<Asset>>>('/v1/assets', { params }).then((r) => r.data);
  },
```
Replace with:
```ts
  list: (page = 1, limit = 15, search?: string, status?: string, assetType?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;
    if (assetType) params.assetType = assetType;
    return client.get<ApiResponse<PaginatedResponse<Asset>>>('/v1/assets', { params }).then((r) => r.data);
  },
```

- [ ] **Step 2: Parameterize `AssetRegistryList`**

Find:
```tsx
export function AssetRegistryList({ basePath }: Readonly<{ basePath: string }>) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const limit = 15;

  useEffect(() => {
    assetsApi
      .list(page, limit, search || undefined, filterStatus || undefined)
      .then((res) => {
        setAssets(res.data.data ?? []);
        setTotalPages(res.data.totalPages ?? 1);
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [page, search, filterStatus]);
```
Replace with:
```tsx
export function AssetRegistryList({
  basePath,
  assetType,
  title = 'Asset Inventory',
}: Readonly<{ basePath: string; assetType?: string; title?: string }>) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const limit = 15;

  useEffect(() => {
    assetsApi
      .list(page, limit, search || undefined, filterStatus || undefined, assetType)
      .then((res) => {
        setAssets(res.data.data ?? []);
        setTotalPages(res.data.totalPages ?? 1);
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [page, search, filterStatus, assetType]);
```

Then find:
```tsx
      <PageHeader
        title="Asset Inventory"
```
Replace with:
```tsx
      <PageHeader
        title={title}
```
(Nothing else in the file changes — the table, pagination, and "Register New Asset" link all read `basePath`/`assets` exactly as before.)

- [ ] **Step 3: Wire the router**

Current file (`Frontend/app/property-custodian/[[...slug]]/page.tsx`):
```tsx
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { AssetInventoryGallery } from '@/components/inventory/AssetInventoryGallery';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.PROPERTY_CUSTODIAN} />;
  if (segment === 'fixed-assets') return <AssetInventoryGallery kind="property" />;
  if (segment === 'supplies') return <AssetInventoryGallery kind="supply" />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_CUSTODIAN} slug={segment} />;
}
```

Replace with:
```tsx
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { RoleDashboard } from '@/components/prototype/RoleDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <RoleDashboard role={ProposedUserRole.PROPERTY_CUSTODIAN} />;
  if (segment === 'fixed-assets' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/fixed-assets" />;
  if (segment === 'fixed-assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/fixed-assets" formsPath="/it-personnel/forms" />;
  if (segment === 'fixed-assets') return <AssetRegistryList basePath="/property-custodian/fixed-assets" assetType="Fixed" title="Fixed Asset Registry" />;
  if (segment === 'supplies' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/supplies" />;
  if (segment === 'supplies' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/supplies" formsPath="/it-personnel/forms" />;
  if (segment === 'supplies') return <AssetRegistryList basePath="/property-custodian/supplies" assetType="Supplies" title="Supply Inventory" />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_CUSTODIAN} slug={segment} />;
}
```
(`AssetInventoryGallery` import is removed — nothing else in this file uses
it. `RegisterAssetForm` and `AssetDetailManager` are unmodified, reused
exactly as Phase 1 Task 4 built them — `AssetType`'s exact value `'Fixed'`/
`'Supplies'` is what's passed to the new `assetType` prop, matching the enum
note at the top of this phase.)

- [ ] **Step 4: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint lib/api/assets.ts components/assets/AssetRegistryList.tsx "app/property-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all four clean/succeed.

- [ ] **Step 5: Manual check** (human, browser)

Log in as Property Custodian (check `docs/guides/ROLES.md` for credentials —
add them there first if missing, per the note in `TEAM-HANDOFF.md`). Visit
`/property-custodian/fixed-assets` and `/property-custodian/supplies` —
each should show a genuinely different, correctly-paginated list (Fixed-only
vs Supplies-only), "Register New Asset" should work on both, and clicking a
row should open a real, editable detail page for that specific item.

- [ ] **Step 6: Commit**

```bash
git add Frontend/lib/api/assets.ts Frontend/components/assets/AssetRegistryList.tsx "Frontend/app/property-custodian/[[...slug]]/page.tsx"
git commit -m "feat(property-custodian): wire Fixed Asset Registry and Supply Inventory to real, type-filtered data"
git push
```

---

### Task 14: Wire the Property Custodian Dashboard to real data

**Scope note:** Property Custodian's dashboard differs from Task 2/Task 9's
shape because the role's real destinations differ — there's no single
"assets" page to link a combined total to (the registry is split into
`fixed-assets`/`supplies`), and no "Maintenance & Repair" page exists for
this role (only Disposal). So 2 of the 4 KPI cards are plain (non-clickable)
stat displays instead of links, and the other 2 link to this role's actual
real pages (`fulfillment`, `disposal`) — same honesty-over-imitation
principle as Task 9's 2-card design, not a mistake to "fix" back to 4 links.

**Files:**
- Create: `Frontend/components/property-custodian/PropertyCustodianDashboard.tsx`
- Modify: `Frontend/app/property-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `assetsApi.stats()` → `AssetStats` (`{ total, available, issued, underRepair, flaggedForDisposal, transferred }`, combined Fixed+Supplies — this role's `assetTypeScope`, unaffected by Task 12's new filter since no `assetType` param is passed here), `requisitionsApi.list(1, 15, 'pending_fulfillment')` → `PaginatedResponse<Requisition>` (server-scoped to this role's Fixed+Supplies requisitions, confirmed in `Backend/src/requisitions/requisitions.service.ts`'s `PROPERTY_CUSTODIAN` branch), `notificationsApi.list()` → `{ notifications, unreadCount }`, `useAuth()` → `{ user }`.
- Produces: `PropertyCustodianDashboard` (no props) — rendered directly by the router for `segment === 'dashboard'`.

- [ ] **Step 1: Write the component**

```tsx
// Frontend/components/property-custodian/PropertyCustodianDashboard.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Archive, Boxes, CheckCircle2, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { assetsApi, type AssetStats } from '@/lib/api/assets';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export function PropertyCustodianDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [pendingFulfillment, setPendingFulfillment] = useState<Requisition[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      assetsApi.stats(),
      requisitionsApi.list(1, 15, 'pending_fulfillment'),
      notificationsApi.list(),
    ])
      .then(([statsRes, reqRes, notifRes]) => {
        if (cancelled) return;
        setStats(statsRes.data);
        setPendingFulfillment(reqRes.data.data);
        setPendingTotal(reqRes.data.total);
        setUnreadCount(notifRes.data.unreadCount);
        setError('');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load dashboard data. Please refresh the page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Property Custodian</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-slate-950">Good day, {user?.firstName ?? 'there'}</h1>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><Boxes className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Total assets (Fixed + Supplies)</span><span className="text-2xl font-extrabold text-slate-950">{stats?.total ?? 0}</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Available</span><span className="text-2xl font-extrabold text-slate-950">{stats?.available ?? 0}</span></span>
        </div>
        <Link href="/property-custodian/fulfillment" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><ClipboardList className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Pending fulfillment</span><span className="text-2xl font-extrabold text-slate-950">{pendingTotal}</span></span>
        </Link>
        <Link href="/property-custodian/disposal" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700"><Archive className="h-5 w-5" /></span>
          <span><span className="block text-xs font-semibold text-slate-500">Flagged for disposal</span><span className="text-2xl font-extrabold text-slate-950">{stats?.flaggedForDisposal ?? 0}</span></span>
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h2 className="text-[15px] font-extrabold text-slate-950">Awaiting Fulfillment</h2>
        </div>
        {pendingFulfillment.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Nothing awaiting fulfillment right now.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingFulfillment.slice(0, 6).map((req) => (
              <Link key={req.id} href="/property-custodian/fulfillment" className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50">
                <span className="text-sm font-bold text-slate-950">{req.items[0]?.itemDescription ?? 'Requisition'}</span>
                <span className="text-xs text-slate-500">{req.requestNumber}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Unread notifications: {unreadCount} — <Link href="/property-custodian/notifications" className="font-bold text-blue-700 hover:underline">view all</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the router**

In `Frontend/app/property-custodian/[[...slug]]/page.tsx` (as left by Task 13), add the import and replace the dashboard branch:
```tsx
import { PropertyCustodianDashboard } from '@/components/property-custodian/PropertyCustodianDashboard';
```
```tsx
  if (segment === 'dashboard') return <PropertyCustodianDashboard />;
```
(`RoleDashboard` is used nowhere else in this file — remove its import entirely, same as Task 2 and Task 9 did for their own routers.)

- [ ] **Step 3: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/property-custodian/PropertyCustodianDashboard.tsx "app/property-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all four clean/succeed.

- [ ] **Step 4: Manual check** (human, browser)

Log in as Property Custodian (`property.custodian@cicc.gov.ph` / `PropertyCustodian@2026!`, per `docs/guides/ROLES.md`). Land on `/property-custodian/dashboard`. "Total assets"/"Available" should match the sum of what you see across both `/property-custodian/fixed-assets` and `/property-custodian/supplies`. Clicking "Pending fulfillment" or "Flagged for disposal" navigates correctly; the other two cards are plain (non-clickable) by design.

- [ ] **Step 5: Commit**

```bash
git add Frontend/components/property-custodian/PropertyCustodianDashboard.tsx "Frontend/app/property-custodian/[[...slug]]/page.tsx"
git commit -m "feat(property-custodian): wire dashboard to real asset/requisition/notification data"
git push
```

---

### Task 15: Wire the Property Custodian QR Scanner and a detail-only asset route

**Scope note:** the registry list stays split (`fixed-assets`/`supplies`), so
there's no single `/property-custodian/assets` list page to reuse. But a
QR-scanned asset (which could be either Fixed or Supplies — the scanner has
no way to know in advance) still needs exactly one real detail page to land
on. This task adds `/property-custodian/assets/:id` as a **detail-only**
route — no matching list at `/property-custodian/assets` itself, and no
`assets/new` route either (asset creation already has two real, unambiguous
entry points from Task 13: `fixed-assets/new` and `supplies/new` — a third,
type-ambiguous `assets/new` would be redundant and confusing, so it's
deliberately not added). This route needs none of Task 12's `assetType`
filter — `AssetDetailManager` fetches a single asset by ID, not a filtered
list.

**Files:**
- Modify: `Frontend/app/property-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `QrLookup` (`{ detailBasePath }`, from `Frontend/components/assets/QrLookup.tsx`, unmodified — Phase 1 Task 3), `AssetDetailManager` (`{ assetId, basePath, formsPath }`, unmodified — Phase 1 Task 4).
- Produces: nothing new for other tasks to consume.

- [ ] **Step 1: Add the two new router branches**

Current file:
```tsx
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { PropertyCustodianDashboard } from '@/components/property-custodian/PropertyCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <PropertyCustodianDashboard />;
  if (segment === 'fixed-assets' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/fixed-assets" />;
  if (segment === 'fixed-assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/fixed-assets" formsPath="/it-personnel/forms" />;
  if (segment === 'fixed-assets') return <AssetRegistryList basePath="/property-custodian/fixed-assets" assetType="Fixed" title="Fixed Asset Registry" />;
  if (segment === 'supplies' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/supplies" />;
  if (segment === 'supplies' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/supplies" formsPath="/it-personnel/forms" />;
  if (segment === 'supplies') return <AssetRegistryList basePath="/property-custodian/supplies" assetType="Supplies" title="Supply Inventory" />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_CUSTODIAN} slug={segment} />;
}
```

Replace with:
```tsx
import { AssetDetailManager } from '@/components/assets/AssetDetailManager';
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';
import { QrLookup } from '@/components/assets/QrLookup';
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';
import { PropertyCustodianDashboard } from '@/components/property-custodian/PropertyCustodianDashboard';
import { WorkflowPage } from '@/components/prototype/WorkflowPage';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

export default async function PropertyCustodianPage({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug } = await params;
  const segment = slug?.[0] ?? 'dashboard';
  const child = slug?.[1];
  if (segment === 'dashboard') return <PropertyCustodianDashboard />;
  if (segment === 'fixed-assets' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/fixed-assets" />;
  if (segment === 'fixed-assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/fixed-assets" formsPath="/it-personnel/forms" />;
  if (segment === 'fixed-assets') return <AssetRegistryList basePath="/property-custodian/fixed-assets" assetType="Fixed" title="Fixed Asset Registry" />;
  if (segment === 'supplies' && child === 'new') return <RegisterAssetForm basePath="/property-custodian/supplies" />;
  if (segment === 'supplies' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/supplies" formsPath="/it-personnel/forms" />;
  if (segment === 'supplies') return <AssetRegistryList basePath="/property-custodian/supplies" assetType="Supplies" title="Supply Inventory" />;
  if (segment === 'assets' && child) return <AssetDetailManager assetId={child} basePath="/property-custodian/assets" formsPath="/it-personnel/forms" />;
  if (segment === 'qr-scanner') return <QrLookup detailBasePath="/property-custodian/assets" />;
  return <WorkflowPage role={ProposedUserRole.PROPERTY_CUSTODIAN} slug={segment} />;
}
```
(`basePath` is currently unused inside `AssetDetailManager`'s own body —
confirmed in Phase 1 Task 4's review — so passing a detail-only base path
with no matching list page is safe; it drives no navigation today.)

- [ ] **Step 2: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint "app/property-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all four clean/succeed.

- [ ] **Step 3: Manual check** (human, browser)

Log in as Property Custodian. Visit `/property-custodian/qr-scanner`, search
by an existing asset's property number or QR value (try one Fixed and one
Supplies asset), and confirm "View Full Asset Details" navigates to
`/property-custodian/assets/<id>` and shows the real, editable detail page
for that specific asset regardless of which subtype it is.

- [ ] **Step 4: Commit**

```bash
git add "Frontend/app/property-custodian/[[...slug]]/page.tsx"
git commit -m "feat(property-custodian): wire QR/barcode lookup and a detail-only asset route to real data"
git push
```

---

### Remaining Phase 4 tasks — scoped, not yet detailed

Expand each to full steps immediately before starting it (rolling wave), following the precedents already established:

- **Property Custodian Fulfillment** — same `isLiveFetchPage` extension as Phase 1 Task 5.
- **Property Custodian Custody & Issuance** — same extension as Phase 1 Task 6, reusing `assetApiToRow`/the custody `ConfirmDialog` fields as-is.
- **Property Custodian Disposal Recommendations** — same extension as Phase 1 Task 8: reuses `submitMaintenanceDecision('Recommend Disposal')` directly (this role has no "Maintenance & Repair" page at all, only disposal — there's nothing else to reuse from, but the function itself is role-agnostic, so it still applies unchanged), `fetchLiveRows` filtered to `status: 'available'`.
- **Property Officer Dashboard** — same technique, "Consolidated Dashboard."
- **Property Officer Consolidated Asset Registry** (`/property-officer/assets`) — same technique as Phase 1 Task 4 exactly (single unified list, the role's full Fixed+Supplies scope, no split, no Task 12 filter needed).
- **Property Officer Reports & Forms** (`/property-officer/reports`) — same technique as Task 11 (`FormsArchiveContent`, read-only browse + re-download): `PROPERTY_OFFICER` authorizes `GET /v1/reports/forms` and the download endpoint but not `POST /v1/reports/forms/generate` or `POST /v1/reports/generate` — read-only-only, same reasoning as Task 11.

---

---

## Plan maintenance

Update this file in place as work proceeds: check off completed steps, and when a numbered task or phase finishes, replace its scoped description with what's actually done (matching how Tasks 1-4 are already written) before starting the next one. This file is the single tracking artifact for this effort — no separate status document.
