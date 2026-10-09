'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileWarning, PackageCheck, Plus, Search } from 'lucide-react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { AdminPageHeader, MetricCard, Panel, PrimaryButton, SearchToolbar, SecondaryButton, StatusChip, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { assetsApi, type Asset, type CatalogueItem } from '@/lib/api/assets';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { catalogueItemKey } from '@/components/requisitions/CatalogueItemPicker';
import { RequisitionForm } from '@/components/requisitions/RequisitionForm';
import { formatAvailability } from '@/lib/requisitions/catalogue-items';
import { formatDate, formatDateTime, requisitionStatusLabel } from '@/lib/requisitions/requisition-view';
import { RequisitionDetailView } from '@/components/requisitions/RequisitionDetailView';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { assetRequestsApi, type AssetRequest, type AssetRequestType } from '@/lib/api/asset-requests';
import { ALL_REQUEST_TYPES, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, REQUEST_TYPE_LABEL, blockingRequest, isOpen } from '@/lib/asset-requests/asset-request-rules';
import { AssetRequestForm } from '@/components/asset-requests/AssetRequestForm';
import { AssetRequestDetail } from '@/components/asset-requests/AssetRequestDetail';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmployeeDashboard } from './EmployeeDashboard';

type EmployeeSlug = 'dashboard' | 'catalogue' | 'requisitions' | 'new-requisition' | 'assigned-assets' | 'returns-incidents';

export function EmployeeWorkspace({ slug, openId }: Readonly<{ slug: EmployeeSlug; openId?: string }>) {
  if (slug === 'dashboard') return <EmployeeDashboard />;
  if (slug === 'catalogue') return <EmployeeCatalogue />;
  if (slug === 'requisitions' || slug === 'new-requisition') return <EmployeeRequisitions initialCreateOpen={slug === 'new-requisition'} />;
  if (slug === 'assigned-assets') return <EmployeeAssignedAssets />;
  return <EmployeeIncidents openId={openId} />;
}

function EmployeeHeader({ title, detail, action }: Readonly<{ title: string; detail: string; action?: React.ReactNode }>) {
  return <AdminPageHeader eyebrow="Employee Workspace" title={title} detail={detail} action={action} />;
}

// Conditions that genuinely warrant an employee's attention before requesting the item —
// mirrors packages/shared/src/enums AssetCondition minus SERVICEABLE.
const ATTENTION_CONDITIONS = new Set(['unserviceable', 'for_repair', 'for_disposal']);

const CATALOGUE_FILTERS = ['All', 'ICT', 'Fixed', 'Supplies', 'PPE', 'SEP', 'IES'];
const TYPE_FILTERS = new Set(['ICT', 'Fixed', 'Supplies']);

function EmployeeCatalogue() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<CatalogueItem | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    // Grouped, available-only inventory; search and filter run server-side so
    // the page stays correct at full inventory scale.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      assetsApi.catalogueItems({
        search: search.trim() || undefined,
        assetType: TYPE_FILTERS.has(filter) ? filter : undefined,
        assetClass: filter !== 'All' && !TYPE_FILTERS.has(filter) ? filter : undefined,
        limit: 100,
      })
        .then((res) => !cancelled && setItems(res.data))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, filter]);

  const unitsOf = (type: string) => items.filter((i) => i.assetType === type).reduce((sum, i) => sum + i.available, 0);

  return <div className="space-y-4"><EmployeeHeader title="Asset Catalogue" detail="Browse assets and supplies available for requisition. Availability is confirmed by the responsible custodian after approval." />
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Requestable items" value={String(items.length)} detail="Distinct items matching your filters" tone="blue" icon={Search} /><MetricCard label="ICT units available" value={String(unitsOf('ICT'))} detail="Subject to fulfillment check" tone="green" icon={PackageCheck} /><MetricCard label="Needs attention" value={String(items.filter((i) => i.conditions.some((c) => ATTENTION_CONDITIONS.has(c))).length)} detail="Flagged condition — verify before requesting" tone="amber" icon={AlertTriangle} /></div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All catalogue items" filterValue={filter} filterOptions={CATALOGUE_FILTERS} onFilterChange={setFilter} />
    {loading ? <Panel title="Request Catalogue" detail="Loading catalogue..."><div className="p-4"><LoadingSkeleton rows={8} /></div></Panel> : items.length === 0 ? <Panel title="Request Catalogue" detail="0 items match your filters"><div className="p-8 text-center text-sm text-slate-500">No catalogue items are currently available for requisition.</div></Panel> : <Panel title="Request Catalogue" detail={`${items.length} items match your filters`}><TableWrap><table className="min-w-[900px] w-full"><thead><tr><th className={thClass}>Item</th><th className={thClass}>Class</th><th className={thClass}>Type</th><th className={thClass}>Availability</th><th className={thClass}>Location</th><th className={thClass}>Condition</th><th className={`${thClass} text-right`}>Request</th></tr></thead><tbody>{items.map((item) => { const key = catalogueItemKey(item); return <tr key={key} className="hover:bg-slate-50"><td className={tdClass}><p className="font-bold text-slate-950">{item.itemDescription}</p><p className="text-xs text-slate-500">{[item.brand, item.itemCode].filter(Boolean).join(' · ') || '—'}</p></td><td className={tdClass}>{item.assetClass}</td><td className={tdClass}>{item.assetType}</td><td className={tdClass}><span className="font-semibold text-emerald-700">{formatAvailability(item)}</span></td><td className={tdClass}>{item.locations.join(' · ') || '—'}</td><td className={tdClass}><StatusChip status={item.conditions.join(', ').replaceAll('_', ' ') || 'Unspecified'} /></td><td className={`${tdClass} text-right`}><button type="button" disabled={requested.includes(key)} onClick={() => setSelected(item)} className="h-8 rounded-md bg-blue-700 px-3 text-xs font-bold text-white hover:bg-blue-800 disabled:bg-emerald-600">{requested.includes(key) ? 'Requested' : 'Request item'}</button></td></tr>; })}</tbody></table></TableWrap></Panel>}
    <CenteredModal open={Boolean(selected)} title={selected ? `Request ${selected.itemDescription}` : 'Request item'} description="Complete the details below to submit this item for approval." onClose={() => setSelected(null)}>{selected && <RequisitionForm defaultItem={selected} onSubmit={(created) => { setRequested((current) => [...current, catalogueItemKey(selected)]); setSelected(null); setToast(`${selected.itemDescription} request ${created.requestNumber} was submitted for approval.`); }} />}</CenteredModal><Toast message={toast} /></div>;
}

function EmployeeRequisitions({ initialCreateOpen = false }: Readonly<{ initialCreateOpen?: boolean }>) {
  const [requests, setRequests] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [creating, setCreating] = useState(initialCreateOpen);
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    requisitionsApi.mine()
      .then((res) => setRequests(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rows = requests.filter((request) => {
    const matchesFilter = filter === 'All' || request.status === filter || request.requisitionType === filter;
    const haystack = [request.requestNumber, request.status, request.requisitionType, request.justification, ...(request.items ?? []).map((item) => item.itemDescription)].join(' ').toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  });

  const handleCreate = (created: Requisition) => { setRequests((current) => [created, ...current]); setCreating(false); setToast(`${created.requestNumber} was submitted for approval.`); };

  return <div className="space-y-4"><EmployeeHeader title="My Requisitions" detail="Create requests and track approval, fulfillment, remarks, and lifecycle progress." action={<PrimaryButton icon={Plus} onClick={() => setCreating(true)}>New requisition</PrimaryButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total requests" value={String(requests.length)} detail="Your records only" tone="blue" icon={ClipboardList} /><MetricCard label="Pending approval" value={String(requests.filter((item) => item.status === 'pending_supervisor').length)} detail="Awaiting supervisor decision" tone="amber" icon={CalendarClock} /><MetricCard label="On hold" value={String(requests.filter((item) => item.status === 'on_hold').length)} detail="Asset unavailable — IT Personnel notified" tone="red" icon={FileWarning} /><MetricCard label="Fulfilled" value={String(requests.filter((item) => item.status === 'fulfilled').length)} detail="Issued or completed" tone="green" icon={CheckCircle2} /></div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All requisitions" filterValue={filter} filterOptions={['All', 'pending_supervisor', 'pending_fulfillment', 'on_hold', 'fulfilled', 'rejected', 'cancelled', 'new', 'replacement', 'repair', 'supply']} onFilterChange={setFilter} />
    {loading ? <Panel title="Requisition History" detail="Loading your requisitions..."><div className="p-4"><LoadingSkeleton rows={6} /></div></Panel> : rows.length === 0 ? <Panel title="Requisition History" detail="0 requests match your filters"><div className="p-8 text-center text-sm text-slate-500">You have not submitted any requisitions yet.</div></Panel> : <Panel title="Requisition History" detail={`${rows.length} requests shown`}><TableWrap><table className="min-w-[1000px] w-full"><thead><tr><th className={thClass}>Request</th><th className={thClass}>Type</th><th className={thClass}>Quantity</th><th className={thClass}>Required date</th><th className={thClass}>Approving officer</th><th className={thClass}>Last update</th><th className={thClass}>Status</th></tr></thead><tbody>{rows.map((request) => { const items = request.items ?? []; const primaryItem = items[0]?.itemDescription ?? 'Requisition'; const extraItems = items.length > 1 ? ` +${items.length - 1} more` : ''; const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0); return <tr key={request.id} className="hover:bg-slate-50"><td className={tdClass}><button type="button" onClick={() => setSelected(request)} className="text-left"><span className="block font-bold text-slate-950">{primaryItem}{extraItems}</span><span className="text-xs text-slate-500">{request.requestNumber}</span></button></td><td className={tdClass}>{request.requisitionType.replace(/_/g, ' ')}</td><td className={tdClass}>{totalQuantity}</td><td className={tdClass}>{formatDate(request.requiredDate)}</td><td className={tdClass}>{request.approver?.name ?? 'Not yet assigned'}</td><td className={tdClass}>{formatDateTime(request.updatedAt)}</td><td className={tdClass}><StatusBadge status={request.status} label={requisitionStatusLabel(request.status)} /></td></tr>; })}</tbody></table></TableWrap></Panel>}
    <CenteredModal open={creating} title="New requisition" description="Provide the request details and justification for approval." onClose={() => setCreating(false)}><RequisitionForm onSubmit={handleCreate} /></CenteredModal>
    <DetailDrawer open={Boolean(selected)} title={selected?.requestNumber ?? 'Requisition details'} onClose={() => setSelected(null)}>{selected && <RequisitionDetailView request={selected} />}</DetailDrawer><Toast message={toast} /></div>;
}


// Why a non-issued asset is still on the holder's list.
const HOLDING_NOTE: Record<string, string> = {
  under_repair: 'Under repair — it will be returned to you and stays under your accountability.',
  flagged_for_disposal: 'Reported lost, stolen or damaged — it stays on your accountability record until COA grants relief.',
};

// Live "My Assigned Assets" — the assets actually issued to the logged-in user
// (GET /assets/mine) plus their return / incident requests. Request buttons
// follow the same one-open-request rule the backend enforces; while a request
// is open the card shows it with a Cancel option instead.
function EmployeeAssignedAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filing, setFiling] = useState<{ asset: Asset; type: AssetRequestType } | null>(null);
  const [cancelling, setCancelling] = useState<AssetRequest | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(
    () => Promise.all([assetsApi.mine(), assetRequestsApi.mine()]).then(([a, r]) => { setAssets(a.data); setRequests(r.data); }),
    [],
  );
  useEffect(() => {
    load().catch(() => setError('Failed to load your assets. Please refresh the page.')).finally(() => setLoading(false));
  }, [load]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const openFor = (assetId: string) => requests.filter((r) => r.asset?.id === assetId && isOpen(r));
  const openTotal = requests.filter(isOpen).length;

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await assetRequestsApi.cancel(cancelling.id);
      notify(`${cancelling.requestNumber} cancelled.`);
      await load();
    } catch {
      notify('Could not cancel the request. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  const buttons: Array<{ type: AssetRequestType; label: string }> = [
    { type: 'return', label: 'Request return' },
    { type: 'repair', label: 'Request repair' },
    { type: 'damage', label: 'Report damage' },
    { type: 'loss', label: 'Report loss / theft' },
  ];

  return <div className="space-y-4"><EmployeeHeader title="My Assigned Assets" detail="Property currently issued to you. Request a return or report repair, damage, loss or theft — the responsible custodian is notified." />
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard label="Assigned to me" value={String(assets.length)} detail="Current accountability" tone="blue" icon={PackageCheck} />
      <MetricCard label="Open requests" value={String(openTotal)} detail="Returns and incidents in progress" tone="amber" icon={ClipboardList} />
      <MetricCard label="Return due" value={String(assets.filter((a) => a.expectedReturnDate).length)} detail="Assets with an expected return date" tone="red" icon={CalendarClock} />
    </div>
    {loading ? <Panel title="Assigned assets" detail="Loading..."><div className="p-4"><LoadingSkeleton rows={4} /></div></Panel>
      : assets.length === 0 ? <Panel title="Assigned assets" detail="Nothing is issued to you right now."><p className="p-4 text-sm text-slate-500">When a custodian issues an asset to you, it will appear here.</p></Panel>
      : <div className="grid gap-4 lg:grid-cols-2">{assets.map((asset) => {
        const forAsset = requests.filter((r) => r.asset?.id === asset.id);
        const open = openFor(asset.id);
        const issued = asset.status === 'issued';
        return <article key={asset.id} className="border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-base font-bold text-slate-950">{asset.itemDescription}</p><p className="mt-1 text-xs text-slate-500">{[asset.propertyNumber, asset.serialNumber && `Serial ${asset.serialNumber}`].filter(Boolean).join(' · ') || asset.assetType}</p></div><StatusChip status={asset.condition.replaceAll('_', ' ')} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{[['Status', asset.status.replaceAll('_', ' ')], ['Expected return', asset.expectedReturnDate ? formatDate(asset.expectedReturnDate) : 'No fixed date'], ['Type', `${asset.assetType} · ${asset.assetClass}`], ['Location', asset.officeLocation || asset.officeOrSection || '—']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{value}</dd></div>)}</dl>
          {open.map((r) => <div key={r.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <span><span className="font-bold text-amber-900">{REQUEST_TYPE_LABEL[r.type]}</span> <span className="text-amber-800">· {r.requestNumber} · {REQUEST_STATUS_LABEL[r.status]}{r.handoverDate ? ` · bring it in ${formatDate(r.handoverDate)}` : ''}</span></span>
            <span className="flex gap-2"><Link href={`/employee/returns-incidents?open=${r.id}`} className="text-xs font-bold text-blue-700 hover:underline">View</Link><button type="button" onClick={() => setCancelling(r)} className="text-xs font-bold text-red-700 hover:underline">Cancel request</button></span>
          </div>)}
          {!issued && <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{HOLDING_NOTE[asset.status] ?? 'Requests can be filed only while the asset is issued to you.'}</p>}
          <div className="mt-4 flex flex-wrap gap-2">{buttons.map(({ type, label }) => {
            const blocker = blockingRequest(type, forAsset);
            return <span key={type} title={blocker ? `${blocker.requestNumber} is still open for this asset` : undefined}><SecondaryButton disabled={!issued || Boolean(blocker)} onClick={() => setFiling({ asset, type })}>{label}</SecondaryButton></span>;
          })}</div>
        </article>;
      })}</div>}
    <DetailDrawer open={Boolean(filing)} title={filing ? `${REQUEST_TYPE_LABEL[filing.type]} — ${filing.asset.itemDescription}` : ''} onClose={() => setFiling(null)}>
      {filing && <AssetRequestForm
        key={`${filing.asset.id}-${filing.type}`}
        assets={assets}
        myRequests={requests}
        fixedAssetId={filing.asset.id}
        {...(filing.type === 'loss' ? { initialType: 'loss' as const } : { fixedType: filing.type })}
        onSubmitted={(r) => { setFiling(null); notify(`${r.requestNumber} submitted — the ${r.custodianLabel ?? 'custodian'} has been notified.`); void load(); }}
      />}
    </DetailDrawer>
    <ConfirmDialog open={Boolean(cancelling)} title={`Cancel ${cancelling?.requestNumber ?? ''}?`} detail="The custodian will be notified that you no longer need this request." confirmLabel="Cancel request" onConfirm={() => void confirmCancel()} onCancel={() => setCancelling(null)} />
    <Toast message={toast} />
  </div>;
}

// Live "Returns & Incidents" — every return / incident request the user filed,
// with status, attachments and the custodian's decisions. `openId` comes from a
// notification deep-link and opens that request's drawer on arrival.
function EmployeeIncidents({ openId }: Readonly<{ openId?: string }>) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<AssetRequest | null>(null);
  const [cancelling, setCancelling] = useState<AssetRequest | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState('');

  const load = useCallback(
    () => Promise.all([assetsApi.mine(), assetRequestsApi.mine()]).then(([a, r]) => { setAssets(a.data); setRequests(r.data); return r.data; }),
    [],
  );
  useEffect(() => {
    load().catch(() => setError('Failed to load your requests. Please refresh the page.')).finally(() => setLoading(false));
  }, [load]);

  const handledOpenId = useRef<string | null>(null);
  useEffect(() => {
    if (!openId || loading || handledOpenId.current === openId) return;
    handledOpenId.current = openId;
    assetRequestsApi.getOne(openId).then((res) => setSelected(res.data)).catch(() => setError('That request could not be found.'));
  }, [openId, loading]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      const res = await assetRequestsApi.cancel(cancelling.id);
      notify(`${cancelling.requestNumber} cancelled.`);
      if (selected?.id === res.data.id) setSelected(res.data);
      await load();
    } catch {
      notify('Could not cancel the request. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  const filters = ['All', 'Open', ...ALL_REQUEST_TYPES.map((t) => REQUEST_TYPE_LABEL[t]), 'Completed', 'Rejected', 'Cancelled'];
  const rows = requests.filter((r) => {
    if (filter === 'Open' && !isOpen(r)) return false;
    if (['Completed', 'Rejected', 'Cancelled'].includes(filter) && r.status !== filter.toLowerCase()) return false;
    if (ALL_REQUEST_TYPES.some((t) => REQUEST_TYPE_LABEL[t] === filter) && REQUEST_TYPE_LABEL[r.type] !== filter) return false;
    return [r.requestNumber, r.asset?.itemDescription, r.details, REQUEST_TYPE_LABEL[r.type]].join(' ').toLowerCase().includes(search.toLowerCase());
  });
  const hasIssued = assets.some((a) => a.status === 'issued');

  return <div className="space-y-4"><EmployeeHeader title="Returns & Incidents" detail="Return an asset or report a repair, damage, loss or theft involving property assigned to you." action={<PrimaryButton icon={Plus} disabled={!hasIssued} onClick={() => setCreating(true)}>File report</PrimaryButton>} />
    <div className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">For loss or theft, notify your supervisor and the responsible custodian immediately in addition to filing this report.</div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All requests" filterValue={filter} filterOptions={filters} onFilterChange={setFilter} />
    <Panel title="My Requests" detail={loading ? 'Loading...' : `${rows.length} of ${requests.length} requests`}>
      {loading ? <div className="p-4"><LoadingSkeleton rows={4} /></div> : <TableWrap><table className="min-w-[760px] w-full"><thead><tr><th className={thClass}>Request</th><th className={thClass}>Type</th><th className={thClass}>Asset</th><th className={thClass}>Filed</th><th className={thClass}>Status</th><th className={thClass} /></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}>
          <td className={`${tdClass} font-bold text-slate-950`}>{r.requestNumber}</td>
          <td className={tdClass}>{REQUEST_TYPE_LABEL[r.type]}</td>
          <td className={tdClass}>{r.asset?.itemDescription ?? '—'}</td>
          <td className={tdClass}>{formatDateTime(r.createdAt)}</td>
          <td className={tdClass}><StatusChip status={REQUEST_STATUS_LABEL[r.status]} tone={REQUEST_STATUS_TONE[r.status]} /></td>
          <td className={`${tdClass} text-right`}><SecondaryButton onClick={() => setSelected(r)}>View</SecondaryButton></td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No requests yet.</td></tr>}
      </tbody></table></TableWrap>}
    </Panel>
    <DetailDrawer open={creating} title="File return or incident report" onClose={() => setCreating(false)}>
      {creating && <AssetRequestForm assets={assets} myRequests={requests} onSubmitted={(r) => { setCreating(false); notify(`${r.requestNumber} submitted — the ${r.custodianLabel ?? 'custodian'} has been notified.`); void load(); }} />}
    </DetailDrawer>
    <DetailDrawer open={Boolean(selected)} title={selected?.requestNumber ?? 'Request'} onClose={() => setSelected(null)}>
      {selected && <div className="space-y-4">
        <AssetRequestDetail request={selected} audience="requester" />
        {isOpen(selected) && <SecondaryButton onClick={() => setCancelling(selected)}>Cancel request</SecondaryButton>}
      </div>}
    </DetailDrawer>
    <ConfirmDialog open={Boolean(cancelling)} title={`Cancel ${cancelling?.requestNumber ?? ''}?`} detail="The custodian will be notified that you no longer need this request." confirmLabel="Cancel request" onConfirm={() => void confirmCancel()} onCancel={() => setCancelling(null)} />
    <Toast message={toast} />
  </div>;
}

export function EmployeeRequisitionDetail({ id }: Readonly<{ id: string }>) {
  const [request, setRequest] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // GET /v1/requisitions/:id is scoped server-side to requests the caller is
    // permitted to see, so a missing/forbidden record surfaces the same
    // "not found" state below rather than needing a client-side ownership check.
    requisitionsApi.getOne(id)
      .then((res) => setRequest(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="mx-auto max-w-3xl space-y-4"><EmployeeHeader title="Requisition details" detail="Loading your requisition..." /><Panel title="Requisition details"><div className="p-5"><LoadingSkeleton rows={6} /></div></Panel></div>;
  if (!request) return <div className="space-y-4"><EmployeeHeader title="Requisition not found" detail="This request does not exist or is not assigned to the current employee." /><Link href="/employee/requisitions" className="text-sm font-bold text-blue-700">Return to My Requisitions</Link></div>;
  return <div className="mx-auto max-w-3xl space-y-4"><EmployeeHeader title={request.requestNumber} detail="Your requisition details and approval progress." /><Panel title="Requisition Details"><div className="p-5"><RequisitionDetailView request={request} /></div></Panel><Link href="/employee/requisitions" className="inline-flex text-sm font-bold text-blue-700">Back to My Requisitions</Link></div>;
}
