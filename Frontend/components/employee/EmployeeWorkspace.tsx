'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileWarning, PackageCheck, Plus, Search, Send } from 'lucide-react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { AdminPageHeader, Field, inputClass, MetricCard, Panel, PrimaryButton, SearchToolbar, SecondaryButton, StatusChip, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { requisitionsApi, type Requisition, type CreateRequisitionDto } from '@/lib/api/requisitions';
import { assetMockRows } from '@/lib/mock/assets.mock';
import type { MockAsset } from '@/lib/mock/assets.mock';
import { notificationMockRows } from '@/lib/mock/notifications.mock';
import { EmployeeDashboard } from './EmployeeDashboard';

const employeeId = 'EMP-001';

type EmployeeSlug = 'dashboard' | 'catalogue' | 'requisitions' | 'new-requisition' | 'assigned-assets' | 'returns-incidents' | 'notifications';

export function EmployeeWorkspace({ slug }: Readonly<{ slug: EmployeeSlug }>) {
  if (slug === 'dashboard') return <EmployeeDashboard />;
  if (slug === 'catalogue') return <EmployeeCatalogue />;
  if (slug === 'requisitions' || slug === 'new-requisition') return <EmployeeRequisitions initialCreateOpen={slug === 'new-requisition'} />;
  if (slug === 'assigned-assets') return <EmployeeAssignedAssets />;
  if (slug === 'returns-incidents') return <EmployeeIncidents />;
  return <EmployeeNotifications />;
}

function EmployeeHeader({ title, detail, action }: Readonly<{ title: string; detail: string; action?: React.ReactNode }>) {
  return <AdminPageHeader eyebrow="Employee Workspace" title={title} detail={detail} action={action} />;
}

// Conditions that genuinely warrant an employee's attention before requesting the item —
// mirrors packages/shared/src/enums AssetCondition minus SERVICEABLE.
const ATTENTION_CONDITIONS = new Set(['unserviceable', 'for_repair', 'for_disposal']);

function EmployeeCatalogue() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    // GET /v1/assets/catalogue already scopes results to AVAILABLE assets server-side.
    assetsApi.catalogue()
      .then((res) => setAssets(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rows = assets.filter((asset) => (filter === 'All' || asset.assetType === filter || asset.assetClass === filter) && Object.values(asset).join(' ').toLowerCase().includes(search.toLowerCase()));

  return <div className="space-y-4"><EmployeeHeader title="Asset Catalogue" detail="Browse assets and supplies available for requisition. Availability is confirmed by the responsible custodian after approval." />
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Requestable items" value={String(assets.length)} detail="Current catalogue preview" tone="blue" icon={Search} /><MetricCard label="ICT available" value={String(assets.filter((item) => item.assetType === 'ICT').length)} detail="Subject to fulfillment check" tone="green" icon={PackageCheck} /><MetricCard label="Needs attention" value={String(assets.filter((item) => ATTENTION_CONDITIONS.has(item.condition)).length)} detail="Flagged condition — verify before requesting" tone="amber" icon={AlertTriangle} /></div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All catalogue items" filterValue={filter} filterOptions={['All', 'ICT', 'Fixed', 'Supplies', 'PPE', 'SEP', 'IES']} onFilterChange={setFilter} />
    {loading ? <Panel title="Request Catalogue" detail="Loading catalogue..."><div className="p-4"><LoadingSkeleton rows={8} /></div></Panel> : rows.length === 0 ? <Panel title="Request Catalogue" detail="0 items match your filters"><div className="p-8 text-center text-sm text-slate-500">No catalogue items are currently available for requisition.</div></Panel> : <Panel title="Request Catalogue" detail={`${rows.length} items match your filters`}><TableWrap><table className="min-w-[900px] w-full"><thead><tr><th className={thClass}>Item</th><th className={thClass}>Category</th><th className={thClass}>Type</th><th className={thClass}>Availability</th><th className={thClass}>Location</th><th className={thClass}>Condition</th><th className={`${thClass} text-right`}>Request</th></tr></thead><tbody>{rows.map((asset) => <tr key={asset.id} className="hover:bg-slate-50"><td className={tdClass}><p className="font-bold text-slate-950">{asset.itemDescription}</p><p className="text-xs text-slate-500">{[asset.brand, asset.itemCode].filter(Boolean).join(' · ') || asset.id}</p></td><td className={tdClass}>{asset.assetClass}</td><td className={tdClass}>{asset.assetType}</td><td className={tdClass}>{asset.status?.replace(/_/g, ' ')}</td><td className={tdClass}>{asset.officeLocation || asset.officeOrSection || '—'}</td><td className={tdClass}><StatusChip status={asset.condition?.replace(/_/g, ' ') || 'Unspecified'} /></td><td className={`${tdClass} text-right`}><button type="button" disabled={requested.includes(asset.id)} onClick={() => setSelected(asset)} className="h-8 rounded-md bg-blue-700 px-3 text-xs font-bold text-white hover:bg-blue-800 disabled:bg-emerald-600">{requested.includes(asset.id) ? 'Requested' : 'Request item'}</button></td></tr>)}</tbody></table></TableWrap></Panel>}
    <CenteredModal open={Boolean(selected)} title={selected ? `Request ${selected.itemDescription}` : 'Request item'} description="Complete the details below to submit this item for approval." onClose={() => setSelected(null)}>{selected && <RequisitionForm defaultItemDescription={selected.itemDescription} defaultAssetType={selected.assetType} defaultAssetClass={selected.assetClass} onSubmit={(created) => { setRequested((current) => [...current, selected.id]); setSelected(null); setToast(`${selected.itemDescription} request ${created.requestNumber} was submitted for approval.`); }} />}</CenteredModal><Toast message={toast} /></div>;
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
    const haystack = [request.requestNumber, request.status, request.requisitionType, request.justification, ...request.items.map((item) => item.itemDescription)].join(' ').toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  });

  const handleCreate = (created: Requisition) => { setRequests((current) => [created, ...current]); setCreating(false); setToast(`${created.requestNumber} was submitted for approval.`); };

  return <div className="space-y-4"><EmployeeHeader title="My Requisitions" detail="Create requests and track approval, fulfillment, remarks, and lifecycle progress." action={<PrimaryButton icon={Plus} onClick={() => setCreating(true)}>New requisition</PrimaryButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total requests" value={String(requests.length)} detail="Your records only" tone="blue" icon={ClipboardList} /><MetricCard label="Pending approval" value={String(requests.filter((item) => item.status === 'pending_supervisor').length)} detail="Awaiting supervisor decision" tone="amber" icon={CalendarClock} /><MetricCard label="On hold" value={String(requests.filter((item) => item.status === 'on_hold').length)} detail="Asset unavailable — IT Personnel notified" tone="red" icon={FileWarning} /><MetricCard label="Fulfilled" value={String(requests.filter((item) => item.status === 'fulfilled').length)} detail="Issued or completed" tone="green" icon={CheckCircle2} /></div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All requisitions" filterValue={filter} filterOptions={['All', 'pending_supervisor', 'pending_fulfillment', 'on_hold', 'fulfilled', 'rejected', 'cancelled', 'new', 'replacement', 'repair', 'supply']} onFilterChange={setFilter} />
    {loading ? <Panel title="Requisition History" detail="Loading your requisitions..."><div className="p-4"><LoadingSkeleton rows={6} /></div></Panel> : rows.length === 0 ? <Panel title="Requisition History" detail="0 requests match your filters"><div className="p-8 text-center text-sm text-slate-500">You have not submitted any requisitions yet.</div></Panel> : <Panel title="Requisition History" detail={`${rows.length} requests shown`}><TableWrap><table className="min-w-[1000px] w-full"><thead><tr><th className={thClass}>Request</th><th className={thClass}>Type</th><th className={thClass}>Quantity</th><th className={thClass}>Required date</th><th className={thClass}>Approving officer</th><th className={thClass}>Last update</th><th className={thClass}>Status</th></tr></thead><tbody>{rows.map((request) => { const primaryItem = request.items[0]?.itemDescription ?? 'Requisition'; const extraItems = request.items.length > 1 ? ` +${request.items.length - 1} more` : ''; const totalQuantity = request.items.reduce((sum, item) => sum + item.quantity, 0); return <tr key={request.id} className="hover:bg-slate-50"><td className={tdClass}><button type="button" onClick={() => setSelected(request)} className="text-left"><span className="block font-bold text-slate-950">{primaryItem}{extraItems}</span><span className="text-xs text-slate-500">{request.requestNumber}</span></button></td><td className={tdClass}>{request.requisitionType.replace(/_/g, ' ')}</td><td className={tdClass}>{totalQuantity}</td><td className={tdClass}>{String(request.requiredDate).slice(0, 10)}</td><td className={tdClass}>{request.supervisorId ?? 'Not yet assigned'}</td><td className={tdClass}>{new Date(request.updatedAt).toLocaleString()}</td><td className={tdClass}><StatusChip status={request.status.replace(/_/g, ' ')} /></td></tr>; })}</tbody></table></TableWrap></Panel>}
    <CenteredModal open={creating} title="New requisition" description="Provide the request details and justification for approval." onClose={() => setCreating(false)}><RequisitionForm onSubmit={handleCreate} /></CenteredModal>
    <DetailDrawer open={Boolean(selected)} title={selected?.requestNumber ?? 'Requisition details'} onClose={() => setSelected(null)}>{selected && <RequisitionDetailView request={selected} />}</DetailDrawer><Toast message={toast} /></div>;
}

// Real RequisitionItemDto requires assetType/assetClass per item and RequisitionType has no
// "Return" or priority concept — this form now submits directly to POST /v1/requisitions
// with a single line item, owning its own loading/error state so both callers (this
// component's "New requisition" flow and EmployeeCatalogue's catalogue-driven request modal,
// which still passes real Asset.assetType/assetClass values straight through) get a real,
// persisted Requisition back via onSubmit instead of a client-fabricated one.
function RequisitionForm({ defaultItemDescription = '', defaultAssetType = 'ICT', defaultAssetClass = 'SEP', onSubmit }: Readonly<{ defaultItemDescription?: string; defaultAssetType?: string; defaultAssetClass?: string; onSubmit: (created: Requisition) => void }>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const dto: CreateRequisitionDto = {
      requisitionType: String(data.get('requisitionType')),
      justification: String(data.get('justification')),
      requiredDate: String(data.get('requiredDate')),
      items: [{
        itemDescription: String(data.get('itemDescription')),
        quantity: Number(data.get('quantity')),
        assetType: String(data.get('assetType')),
        assetClass: String(data.get('assetClass')),
        justification: String(data.get('justification')),
      }],
    };
    setSubmitting(true);
    try {
      const res = await requisitionsApi.create(dto);
      onSubmit(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to submit requisition.'));
    } finally {
      setSubmitting(false);
    }
  };

  return <form className="space-y-4" onSubmit={handleSubmit}>
    {error && <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    <Field label="Item or requirement"><input name="itemDescription" required defaultValue={defaultItemDescription} className={inputClass} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Asset type"><select name="assetType" defaultValue={defaultAssetType} className={inputClass}><option value="ICT">ICT</option><option value="Fixed">Fixed</option><option value="Supplies">Supplies</option></select></Field><Field label="Asset class"><select name="assetClass" defaultValue={defaultAssetClass} className={inputClass}><option value="PPE">PPE</option><option value="SEP">SEP</option><option value="IES">IES</option></select></Field></div>
    <Field label="Request type"><select name="requisitionType" className={inputClass}><option value="new">New</option><option value="replacement">Replacement</option><option value="repair">Repair</option><option value="supply">Supply</option></select></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity"><input name="quantity" type="number" min="1" max="99" defaultValue="1" className={inputClass} /></Field><Field label="Required date"><input name="requiredDate" required type="date" className={inputClass} /></Field></div>
    <Field label="Business justification"><textarea name="justification" required minLength={20} className={`${inputClass} h-28 py-2`} placeholder="Explain the operational need and intended use." /></Field>
    <div className="border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Submission routes to your assigned Approving Officer. Availability and issuance are confirmed by the responsible custodian after approval.</div>
    <PrimaryButton type="submit" icon={Send} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit requisition'}</PrimaryButton>
  </form>;
}

// Real-data detail view shared by EmployeeRequisitions' inline drawer and the
// EmployeeRequisitionDetail route page below, so both surfaces render the same
// Requisition shape identically instead of duplicating this JSX. Reconstructs the
// former mock "Progress Timeline" from real timestamp fields instead of dropping it, since
// submittedAt/supervisorDecidedAt/fulfilledAt carry the same lifecycle information.
function RequisitionDetailView({ request }: Readonly<{ request: Requisition }>) {
  const timeline: Array<{ label: string; at: string }> = [{ label: 'Submitted for approval', at: request.submittedAt }];
  if (request.supervisorDecidedAt) timeline.push({ label: request.supervisorDecision === 'rejected' ? 'Rejected by supervisor' : 'Approved by supervisor', at: request.supervisorDecidedAt });
  if (request.fulfilledAt) timeline.push({ label: 'Fulfilled by IT Personnel', at: request.fulfilledAt });

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold text-slate-950">{request.items.map((item) => item.itemDescription).join(', ')}</p><p className="mt-1 text-xs text-slate-500">{request.requestNumber} · Submitted {String(request.submittedAt).slice(0, 10)}</p></div><StatusChip status={request.status.replace(/_/g, ' ')} /></div>
    <div className="grid grid-cols-2 gap-3">{[['Type', request.requisitionType.replace(/_/g, ' ')], ['Total quantity', String(request.items.reduce((sum, item) => sum + item.quantity, 0))], ['Required date', String(request.requiredDate).slice(0, 10)], ['Approving officer', request.supervisorId ?? 'Not yet assigned']].map(([label, value]) => <div key={label} className="border border-slate-200 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>
    <div><p className="text-xs font-bold text-slate-500">Items requested</p><div className="mt-2 space-y-2">{request.items.map((item) => <div key={item.id} className="border border-slate-200 p-3 text-sm"><p className="font-semibold text-slate-800">{item.itemDescription}</p><p className="mt-1 text-xs text-slate-500">{item.assetType} · {item.assetClass} · Qty {item.quantity}</p></div>)}</div></div>
    <div><p className="text-xs font-bold text-slate-500">Justification</p><p className="mt-2 text-sm text-slate-700">{request.justification}</p></div>
    {request.supervisorComments && <div className="border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">Approver remarks</p><p className="mt-1 text-sm text-amber-800">{request.supervisorComments}</p></div>}
    <Panel title="Progress Timeline"><div className="divide-y divide-slate-100 px-4">{timeline.map((step, index) => <div key={step.label} className="flex items-center gap-3 py-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span><span className="text-sm text-slate-700">{step.label}</span><span className="ml-auto text-xs text-slate-500">{String(step.at).slice(0, 10)}</span></div>)}</div></Panel>
  </div>;
}

function EmployeeAssignedAssets() {
  const [assets, setAssets] = useState(() => assetMockRows.filter((asset) => asset.assignedEmployeeId === employeeId));
  const [selected, setSelected] = useState<MockAsset | null>(null);
  const [action, setAction] = useState<'Acknowledge' | 'Return' | 'Damage' | 'Repair' | null>(null);
  const [toast, setToast] = useState('');
  const openAction = (asset: MockAsset, nextAction: typeof action) => { setSelected(asset); setAction(nextAction); };
  return <div className="space-y-4"><EmployeeHeader title="My Assigned Assets" detail="Review property issued to you, confirm accountability, and initiate return, damage, or repair workflows." />
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Assigned to me" value={String(assets.length)} detail="Current accountability" tone="blue" icon={PackageCheck} /><MetricCard label="Pending acknowledgment" value={String(assets.filter((item) => item.acknowledgmentStatus === 'Pending').length)} detail="Confirm receipt and condition" tone="red" icon={CheckCircle2} /><MetricCard label="Return due" value={String(assets.filter((item) => item.returnDate).length)} detail="Review expected return dates" tone="amber" icon={CalendarClock} /></div>
    <div className="grid gap-4 lg:grid-cols-2">{assets.map((asset) => <article key={asset.id} className="border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-bold text-slate-950">{asset.name}</p><p className="mt-1 text-xs text-slate-500">{asset.id} - {asset.serialNumber}</p></div><StatusChip status={asset.condition} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{[['Issued date', asset.issuedDate ?? '-'], ['Expected return', asset.returnDate ?? 'No fixed date'], ['Division', 'Digital Forensics'], ['Location', asset.location], ['Status', asset.status], ['Acknowledgment', asset.acknowledgmentStatus]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-800">{value}</dd></div>)}</dl><div className="mt-4 flex flex-wrap gap-2">{asset.acknowledgmentStatus === 'Pending' && <PrimaryButton onClick={() => openAction(asset, 'Acknowledge')}>Acknowledge receipt</PrimaryButton>}<SecondaryButton onClick={() => openAction(asset, 'Return')}>Request return</SecondaryButton><SecondaryButton onClick={() => openAction(asset, 'Repair')}>Request repair</SecondaryButton><SecondaryButton onClick={() => openAction(asset, 'Damage')}>Report damage</SecondaryButton></div></article>)}</div>
    <DetailDrawer open={Boolean(selected && action)} title={`${action ?? ''} - ${selected?.name ?? ''}`} onClose={() => { setSelected(null); setAction(null); }}>{selected && action && <AssetActionForm asset={selected} action={action} onSubmit={() => {
  // Only Acknowledge updates asset state in this mock — Return/Damage/Repair
  // always show the toast and close, matching the rest of this prototype's
  // pattern. Braced so the conditional scope reads unambiguously.
  if (action === 'Acknowledge') {
    setAssets((current) => current.map((asset) => (asset.id === selected.id ? { ...asset, acknowledgmentStatus: 'Acknowledged' } : asset)));
  }
  setToast(`${action} request recorded for ${selected.name}.`);
  setSelected(null);
  setAction(null);
}} />}</DetailDrawer><Toast message={toast} /></div>;
}

function AssetActionForm({ asset, action, onSubmit }: Readonly<{ asset: MockAsset; action: 'Acknowledge' | 'Return' | 'Damage' | 'Repair'; onSubmit: () => void }>) {
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="border border-slate-200 p-3 text-sm"><p className="font-bold">{asset.id} - {asset.name}</p><p className="mt-1 text-xs text-slate-500">Serial {asset.serialNumber} - issued {asset.issuedDate}</p></div>{action === 'Acknowledge' ? <><label className="flex items-start gap-3 text-sm"><input required type="checkbox" className="mt-1 h-4 w-4 accent-blue-700" /><span>I confirm that I received this asset and that its identifying information and recorded condition are accurate.</span></label><Field label="Condition upon receipt"><select className={inputClass}><option>Serviceable</option><option>Serviceable with remarks</option></select></Field></> : <><Field label={action === 'Return' ? 'Preferred return date' : 'Date observed'}><input required type="date" className={inputClass} /></Field><Field label="Details and justification"><textarea required minLength={15} className={`${inputClass} h-28 py-2`} placeholder="Describe the condition, issue, or reason." /></Field><Field label="Supporting attachment name (optional)"><input className={inputClass} placeholder="photo-or-report.jpg" /></Field></>}<PrimaryButton type="submit">Submit {action.toLowerCase()}</PrimaryButton></form>;
}

type Incident = { id: string; type: string; asset: string; reported: string; details: string; status: string };

function EmployeeIncidents() {
  const [reports, setReports] = useState<Incident[]>([{ id: 'INC-2026-004', type: 'Repair request', asset: 'Dell Latitude 5440', reported: 'Jul 8, 2026', details: 'Intermittent overheating during imaging.', status: 'Under review' }]);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState('');
  const rows = reports.filter((report) => (filter === 'All' || report.type === filter || report.status === filter) && Object.values(report).join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4"><EmployeeHeader title="Returns & Incidents" detail="Initiate an asset return or report repair, damage, loss, or theft involving property assigned to you." action={<PrimaryButton icon={Plus} onClick={() => setCreating(true)}>File report</PrimaryButton>} />
    <div className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">For loss or theft, notify your supervisor and the responsible custodian immediately in addition to filing this system report.</div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All report types" filterValue={filter} filterOptions={['All', 'Return request', 'Repair request', 'Damage report', 'Loss report', 'Theft report', 'Under review', 'Submitted']} onFilterChange={setFilter} />
    <Panel title="My Reports" detail={`${rows.length} return and incident records`}><TableWrap><table className="min-w-[760px] w-full"><thead><tr><th className={thClass}>Report</th><th className={thClass}>Type</th><th className={thClass}>Asset</th><th className={thClass}>Reported</th><th className={thClass}>Details</th><th className={thClass}>Status</th></tr></thead><tbody>{rows.map((report) => <tr key={report.id}><td className={`${tdClass} font-bold text-slate-950`}>{report.id}</td><td className={tdClass}>{report.type}</td><td className={tdClass}>{report.asset}</td><td className={tdClass}>{report.reported}</td><td className={`${tdClass} max-w-xs truncate`}>{report.details}</td><td className={tdClass}><StatusChip status={report.status} /></td></tr>)}</tbody></table></TableWrap></Panel>
    <DetailDrawer open={creating} title="File return or incident report" onClose={() => setCreating(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const report: Incident = { id: `INC-2026-${String(reports.length + 5).padStart(3, '0')}`, type: String(data.get('type')), asset: String(data.get('asset')), reported: String(data.get('date')), details: String(data.get('details')), status: 'Submitted' }; setReports((current) => [report, ...current]); setCreating(false); setToast(`${report.id} was filed successfully.`); }}><Field label="Report type"><select name="type" className={inputClass}><option>Return request</option><option>Repair request</option><option>Damage report</option><option>Loss report</option><option>Theft report</option></select></Field><Field label="Assigned asset"><select name="asset" className={inputClass}>{assetMockRows.filter((asset) => asset.assignedEmployeeId === employeeId).map((asset) => <option key={asset.id}>{asset.name}</option>)}</select></Field><Field label="Date of return or incident"><input name="date" required type="date" className={inputClass} /></Field><Field label="Details"><textarea name="details" required minLength={20} className={`${inputClass} h-28 py-2`} /></Field><Field label="Attachment name (optional)"><input className={inputClass} placeholder="photo-or-incident-report.pdf" /></Field><PrimaryButton type="submit">Submit report</PrimaryButton></form></DetailDrawer><Toast message={toast} /></div>;
}

function EmployeeNotifications() {
  const [items, setItems] = useState(notificationMockRows);
  const [filter, setFilter] = useState<'All' | 'Unread'>('All');
  const visible = filter === 'Unread' ? items.filter((item) => item.unread) : items;
  return <div className="space-y-4"><EmployeeHeader title="Notifications" detail="Review request, asset, return, and incident updates related to your own records." action={<SecondaryButton onClick={() => setItems((current) => current.map((item) => ({ ...item, unread: false })))}>Mark all read</SecondaryButton>} />
    <div className="flex border-b border-slate-200" role="tablist">{(['All', 'Unread'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`border-b-2 px-4 py-2 text-sm font-bold ${filter === item ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}>{item}{item === 'Unread' ? ` (${items.filter((entry) => entry.unread).length})` : ''}</button>)}</div>
    <Panel title="Notification Inbox" detail={`${visible.length} notifications shown`}><div className="divide-y divide-slate-100">{visible.length === 0 ? <div className="p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 text-sm font-bold">You are all caught up</p><p className="mt-1 text-xs text-slate-500">There are no unread notifications.</p></div> : visible.map((item) => <article key={item.id} className={`flex gap-3 p-4 ${item.unread ? 'bg-blue-50/50' : ''}`}><span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${item.unread ? 'bg-blue-600' : 'bg-slate-300'}`} /><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-slate-950">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-xs font-semibold text-slate-500">{item.category} - {item.relatedId} - {item.date}</p></div><button type="button" onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: !entry.unread } : entry))} className="text-left text-xs font-bold text-blue-700">Mark {item.unread ? 'read' : 'unread'}</button></div></div></article>)}</div></Panel>
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
