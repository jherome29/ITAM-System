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

## Phase 1: IT Asset Custodian

### Task 1: Wire Notifications to the real component

**Files:**
- Modify: `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`

**Interfaces:**
- Consumes: `NotificationsContent` from `@/components/shared/NotificationsContent` (existing, no changes — already real, already used by Supervisor/IT Personnel/Admin/Management/Employee).

- [ ] **Step 1: Add the real component and a router branch for it**

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

- [ ] **Step 2: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0
```
Expected: no output from either command.

- [ ] **Step 3: Manual check** (human, browser)

Log in as IT Personnel, go to `/it-asset-custodian/notifications`. Should show real notifications (or "No notifications" if none exist) and a working "Mark all as read" — not the old mock list.

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Write the component**

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

- [ ] **Step 2: Wire it into the router**

In `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`, add the import and replace the dashboard branch:
```tsx
import { ItAssetCustodianDashboard } from '@/components/it-asset-custodian/ItAssetCustodianDashboard';
```
```tsx
if (segment === 'dashboard') return <ItAssetCustodianDashboard />;
```
(Remove the now-unused `RoleDashboard` import only if nothing else in this file still uses it — it's still used nowhere else in this file after this change, so remove the import line for `RoleDashboard` too.)

- [ ] **Step 3: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/it-asset-custodian/ItAssetCustodianDashboard.tsx "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run build
```
Expected: all three clean/succeed.

- [ ] **Step 4: Manual check** (human, browser)

Log in as IT Personnel. Land on `/it-asset-custodian/dashboard`. KPI numbers should match what you see on `/it-personnel/dashboard` for the same account (both read the same backend). Clicking "Pending fulfillment" or "Under repair" navigates correctly.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Create the shared component**

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

- [ ] **Step 2: Make the old page a thin wrapper**

Replace the full contents of `Frontend/app/it-personnel/qr-scan/page.tsx` with:
```tsx
import { QrLookup } from '@/components/assets/QrLookup';

export default function QrScanPage() {
  return <QrLookup detailBasePath="/it-personnel/assets" />;
}
```

- [ ] **Step 3: Wire it into the new layout's router**

In `Frontend/app/it-asset-custodian/[[...slug]]/page.tsx`, add the import and a branch before the final `WorkflowPage` fallback:
```tsx
import { QrLookup } from '@/components/assets/QrLookup';
```
```tsx
if (segment === 'qr-scanner') return <QrLookup detailBasePath="/it-asset-custodian/assets" />;
```

- [ ] **Step 4: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/assets/QrLookup.tsx app/it-personnel/qr-scan/page.tsx "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run build
```

- [ ] **Step 5: Manual check** (human, browser)

`/it-personnel/qr-scan` still works exactly as before (old layout unaffected). `/it-asset-custodian/qr-scanner`, searching a real property number now returns a real result and "View Full Asset Details" navigates to `/it-asset-custodian/assets/:id` (which won't be real until Task 4 — that's expected at this point in the plan).

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Extract `AssetRegistryList`**

Copy the full current content of `Frontend/app/it-personnel/assets/page.tsx` into a new file `Frontend/components/assets/AssetRegistryList.tsx`, with these exact changes:
- Rename `export default function AssetsInventoryPage()` to `export function AssetRegistryList({ basePath }: Readonly<{ basePath: string }>)`.
- Replace `href="/it-personnel/assets/new"` with `href={`${basePath}/new`}`.
- Replace `href={`/it-personnel/assets/${asset.id}`}` with `href={`${basePath}/${asset.id}`}`.
- Everything else (imports, state, the search/filter logic, the table) stays identical.

- [ ] **Step 2: Make the old list page a thin wrapper**

Replace the full contents of `Frontend/app/it-personnel/assets/page.tsx` with:
```tsx
import { AssetRegistryList } from '@/components/assets/AssetRegistryList';

export default function AssetsInventoryPage() {
  return <AssetRegistryList basePath="/it-personnel/assets" />;
}
```

- [ ] **Step 3: Extract `RegisterAssetForm`**

Copy the full current content of `Frontend/app/it-personnel/assets/new/page.tsx` into a new file `Frontend/components/assets/RegisterAssetForm.tsx`, with these exact changes:
- Rename `export default function NewAssetPage()` to `export function RegisterAssetForm({ basePath }: Readonly<{ basePath: string }>)`.
- In `handleSubmit`'s success path, replace `router.push(`/it-personnel/assets/${res.data.id}`)` with `router.push(`${basePath}/${res.data.id}`)`.
- Replace the "Back to Inventory" button's implicit target (it uses `router.back()`, no hardcoded path — leave unchanged).
- Everything else stays identical.

- [ ] **Step 4: Make the old new-asset page a thin wrapper**

Replace the full contents of `Frontend/app/it-personnel/assets/new/page.tsx` with:
```tsx
import { RegisterAssetForm } from '@/components/assets/RegisterAssetForm';

export default function NewAssetPage() {
  return <RegisterAssetForm basePath="/it-personnel/assets" />;
}
```

- [ ] **Step 5: Extract `AssetDetailManager`**

Copy the full current content of `Frontend/app/it-personnel/assets/[id]/page.tsx` (503 lines — this is the file with the `NEXT_TRANSITIONS`/Condition-dropdown fixes from 2026-08-21, keep those fixes intact) into a new file `Frontend/components/assets/AssetDetailManager.tsx`, with these exact changes:
- Remove the `useParams`/`useRouter` import of `id` from the URL (`const params = useParams(); const id = params.id as string;`). Replace with props: `export function AssetDetailManager({ assetId, basePath, formsPath }: Readonly<{ assetId: string; basePath: string; formsPath: string }>)`. Every remaining reference to the local variable `id` in the file body becomes `assetId` (the `useEffect` dependency array, the `auditApi.byRecord(id)` calls, etc. — mechanical rename, no logic change).
- Rename `export default function AssetDetailPage()` accordingly (removed — it's the function signature above now).
- Replace `router.push('/it-personnel/forms')` with `router.push(formsPath)`.
- The "Back to Inventory" button uses `router.back()` — leave unchanged.
- Everything else (edit mode, the lifecycle modal, `NEXT_TRANSITIONS`, `optionLabel`, form-suggestion banner, transaction history) stays identical.

- [ ] **Step 6: Make the old detail page a thin wrapper**

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

- [ ] **Step 7: Wire all three into the new layout's router**

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

- [ ] **Step 8: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/assets/AssetRegistryList.tsx components/assets/RegisterAssetForm.tsx components/assets/AssetDetailManager.tsx app/it-personnel/assets/page.tsx "app/it-personnel/assets/[id]/page.tsx" app/it-personnel/assets/new/page.tsx "app/it-asset-custodian/[[...slug]]/page.tsx" --max-warnings 0 && npm run test && npm run build
```
Expected: all clean/pass.

- [ ] **Step 9: Manual check** (human, browser) — the important one, do all of it

1. `/it-personnel/assets`, `/it-personnel/assets/new`, `/it-personnel/assets/:id` all still work exactly as before (old layout unaffected — this is the critical regression check, since these three files' logic just moved).
2. `/it-asset-custodian/assets` — real asset list, same data as the old page.
3. Register a new asset via `/it-asset-custodian/assets/new` — succeeds, redirects to the new asset's `/it-asset-custodian/assets/:id`.
4. On that detail page: edit a field and save — persists after refresh. Run a lifecycle transition (issue/return/transfer/repair/dispose) — the "Update Lifecycle" button renders (confirms the 2026-08-21 casing fix carried over correctly) and the transition succeeds.
5. Generate a QR code on that asset, then go back to `/it-asset-custodian/qr-scanner` (Task 3) and look it up — should find it and link back here correctly.

- [ ] **Step 10: Commit**

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

- [ ] **Step 1: Extend `isLiveFetchPage` and add the fulfillment-specific flag**

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

- [ ] **Step 2: Extend `fetchLiveRows` to fetch fulfillment rows**

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

- [ ] **Step 3: Make `detailActions` live-aware for fulfillment**

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

- [ ] **Step 4: Add `submitFulfillmentDecision`**

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

- [ ] **Step 5: Wire the ConfirmDialog to use it**

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

- [ ] **Step 6: Verify**

```bash
cd Frontend && npx tsc --noEmit && npx eslint components/prototype/WorkflowPage.tsx --max-warnings 0 && npm run test && npm run build
```
Expected: all clean/pass.

- [ ] **Step 7: Manual check** (human, browser)

Log in as IT Personnel, go to `/it-asset-custodian/fulfillment`. Should show real pending-fulfillment requisitions (same ones visible via `/it-personnel/requisitions` on the old layout, filtered to `pending_fulfillment`). Open one, confirm the action list shows only "Fulfill" and "On Hold" (not "Reserve"). Fulfill one — refresh the page, confirm it's gone from the list (status changed) and the underlying asset's status updated (check via `/it-asset-custodian/assets/:id` or the old `/it-personnel/assets/:id`). Try "On Hold" on another — confirm it requires a reason, and that the requisition's status changes after confirming.

- [ ] **Step 8: Commit**

```bash
git add Frontend/components/prototype/WorkflowPage.tsx
git commit -m "feat(it-asset-custodian): wire fulfillment queue to real requisitions API"
git push
```

---

### Tasks 6-8: Custody & Issuance, Maintenance & Repair, Disposal Recommendations

Same technique as Task 5 (extend `isLiveFetchPage`/`detailActions`/add a `submitXDecision` function in `WorkflowPage.tsx`), scoped now, expanded to full bite-sized steps immediately before each starts — after Task 5 lands and its review confirms the pattern holds up in practice.

- **Task 6 — Custody & Issuance** (`custody` slug): real equivalent is issuing an asset via `assetsApi.updateLifecycle(id, { status: 'issued', employeeId })` (same modal fields as `AssetDetailManager`'s lifecycle modal from Task 4 — reuse that interaction pattern, don't reinvent it) plus `'returned'`/`'transferred'` transitions. Files: `Frontend/components/prototype/WorkflowPage.tsx`.
- **Task 7 — Maintenance & Repair** (`maintenance` slug): real equivalent is `assetsApi.updateLifecycle(id, { status: 'under_repair' })` / back to `'available'`. Files: `Frontend/components/prototype/WorkflowPage.tsx`.
- **Task 8 — Disposal Recommendations** (`disposal` slug): real equivalent is `assetsApi.updateLifecycle(id, { status: 'flagged_for_disposal', notes })` (notes required — matches the 2026-08-21 fix's required-justification UI). Files: `Frontend/components/prototype/WorkflowPage.tsx`.

---

## Phase 2: Approving Officer's Dashboard

Scoped, not yet detailed. Wire `RoleDashboard`'s Approving Officer branch (or graduate it to its own `ApprovingOfficerDashboard.tsx`, matching the Task 2 precedent) to real `requisitionsApi` data — same shape as Task 2 above. Expand to full steps when Phase 1 is done and merged.

## Phase 3: Management & Audit Viewer's remaining report tabs

Scoped, not yet detailed. Per the spec, needs a pass confirming which of `asset-reports`/`requisition-reports`/`maintenance-disposal`/`physical-count`/`forms` map to existing `reportsApi`/`auditApi` calls before wiring — `physical-count` likely falls under the reconciliation non-goal and gets excluded once confirmed. Expand to full steps when Phase 2 is done.

## Phase 4: Property Custodian / Property Officer asset pages

Scoped, not yet detailed. Same techniques as Phase 1 (Tasks 1-8), applied to `/property-custodian/*` and `/property-officer/*`'s asset/fulfillment/custody pages — backend already scopes these two roles to Fixed + Supplies asset types, confirmed working in the 2026-08-21 audit. Reconciliation/replacement-validation pages excluded per the spec's non-goals. Expand to full steps when Phase 3 is done.

---

## Plan maintenance

Update this file in place as work proceeds: check off completed steps, and when a numbered task or phase finishes, replace its scoped description with what's actually done (matching how Tasks 1-4 are already written) before starting the next one. This file is the single tracking artifact for this effort — no separate status document.
