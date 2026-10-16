'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, ClipboardList, PackageCheck, RefreshCcw } from 'lucide-react';
import { AdminPageHeader, MetricCard, Panel, SecondaryButton, StatusChip, TableWrap, tdClass, thClass } from '@/components/admin/AdminUi';
import { AssetRequestDetail } from '@/components/asset-requests/AssetRequestDetail';
import { AssetRequestForm } from '@/components/asset-requests/AssetRequestForm';
import { RequisitionForm } from '@/components/requisitions/RequisitionForm';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { assetsApi, type MyAsset } from '@/lib/api/assets';
import { assetRequestsApi, type AssetRequest, type AssetRequestType } from '@/lib/api/asset-requests';
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, REQUEST_TYPE_LABEL, blockingRequest, isOpen } from '@/lib/asset-requests/asset-request-rules';
import { locationLabel } from '@/lib/assets/asset-location';
import { formatDate, formatDateTime } from '@/lib/requisitions/requisition-view';
import { humanize } from '@/lib/text';

// Why a non-issued asset is still on the holder's list.
const HOLDING_NOTE: Record<string, string> = {
  under_repair: 'Under repair — it will be returned to you and stays under your accountability.',
  flagged_for_disposal: 'Written off — lost, stolen, or not repairable. It stays on your accountability record until COA grants relief.',
};

/** Where a repair is happening and when it is due back, for the holder. */
function repairNote(asset: MyAsset): string | null {
  if (asset.status !== 'under_repair' || !asset.repair) return null;
  const where = asset.repair.serviceType === 'external'
    ? `at ${asset.repair.serviceProvider || 'an external service center'}`
    : `with the ${asset.assetType === 'ICT' ? 'IT Asset Custodian' : 'Property Custodian'}`;
  return `Under repair ${where} since ${formatDate(asset.repair.openedAt)} — expected back ${formatDate(asset.repair.dueDate)}. It stays under your accountability; you are notified when it is ready.`;
}

const REQUEST_BUTTONS: Array<{ type: AssetRequestType; label: string }> = [
  { type: 'return', label: 'Request return' },
  { type: 'repair', label: 'Request repair' },
  { type: 'damage', label: 'Report damage' },
  { type: 'loss', label: 'Report loss / theft' },
];

/**
 * "My Assigned Assets" for any role — every CICC user can hold property.
 * Lists GET /assets/mine with each asset's return / repair / damage / loss
 * actions (Returns & Incidents, decided by the asset's custodian) and, for the
 * roles that may requisition, "Request replacement" once the asset qualifies
 * (CLAUDE.md §17 — the server says which, and why). Request buttons follow the
 * one-open-request rule the backend enforces.
 *
 * `showRequestHistory` adds the holder's own request list, for workspaces with
 * no separate Returns & Incidents page; `openId` opens one of those requests
 * (notification deep-link).
 */
export function MyAssignedAssets({
  eyebrow,
  canRequestReplacement,
  showRequestHistory = false,
  openId,
}: Readonly<{ eyebrow: string; canRequestReplacement: boolean; showRequestHistory?: boolean; openId?: string }>) {
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filing, setFiling] = useState<{ asset: MyAsset; type: AssetRequestType } | null>(null);
  const [replacing, setReplacing] = useState<MyAsset | null>(null);
  const [viewing, setViewing] = useState<AssetRequest | null>(null);
  const [cancelling, setCancelling] = useState<AssetRequest | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(
    () => Promise.all([assetsApi.mine(), assetRequestsApi.mine()]).then(([a, r]) => { setAssets(a.data); setRequests(r.data); }),
    [],
  );
  useEffect(() => {
    load().catch(() => setError('Failed to load your assets. Please refresh the page.')).finally(() => setLoading(false));
  }, [load]);

  const handledOpenId = useRef<string | null>(null);
  useEffect(() => {
    if (!openId || loading || handledOpenId.current === openId) return;
    handledOpenId.current = openId;
    assetRequestsApi.getOne(openId).then((res) => setViewing(res.data)).catch(() => setError('That request could not be found.'));
  }, [openId, loading]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const openTotal = requests.filter(isOpen).length;

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      const res = await assetRequestsApi.cancel(cancelling.id);
      notify(`${cancelling.requestNumber} cancelled.`);
      if (viewing?.id === res.data.id) setViewing(res.data);
      await load();
    } catch {
      notify('Could not cancel the request. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  return <div className="space-y-4">
    <AdminPageHeader eyebrow={eyebrow} title="My Assigned Assets" detail={`Property currently issued to you. Request a return or repair, report damage, loss or theft${canRequestReplacement ? ', or request a replacement once an asset qualifies' : ''} — the responsible custodian is notified.`} />
    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard label="Assigned to me" value={String(assets.length)} detail="Current accountability" tone="blue" icon={PackageCheck} />
      <MetricCard label="Open requests" value={String(openTotal)} detail="Returns and incidents in progress" tone="amber" icon={ClipboardList} />
      <MetricCard label="Return due" value={String(assets.filter((a) => a.expectedReturnDate).length)} detail="Assets with an expected return date" tone="red" icon={CalendarClock} />
    </div>
    {loading ? <Panel title="Assigned assets" detail="Loading..."><div className="p-4"><LoadingSkeleton rows={4} /></div></Panel>
      : assets.length === 0 ? <Panel title="Assigned assets" detail="Nothing is issued to you right now."><p className="p-4 text-sm text-slate-500">When a custodian issues an asset to you, it will appear here.</p></Panel>
      : <div className="grid gap-4 lg:grid-cols-2">{assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          requests={requests.filter((r) => r.asset?.id === asset.id)}
          canRequestReplacement={canRequestReplacement}
          onFile={(type) => setFiling({ asset, type })}
          onReplace={() => setReplacing(asset)}
          onView={setViewing}
          onCancel={setCancelling}
        />
      ))}</div>}

    {showRequestHistory && !loading && <Panel title="My return & incident requests" detail={`${requests.length} request${requests.length === 1 ? '' : 's'}`}>
      <TableWrap><table className="w-full min-w-[720px]"><thead><tr><th className={thClass}>Request</th><th className={thClass}>Type</th><th className={thClass}>Asset</th><th className={thClass}>Filed</th><th className={thClass}>Status</th><th className={thClass} /></tr></thead><tbody>
        {requests.map((r) => <tr key={r.id}>
          <td className={`${tdClass} font-bold text-slate-950`}>{r.requestNumber}</td>
          <td className={tdClass}>{REQUEST_TYPE_LABEL[r.type]}</td>
          <td className={tdClass}>{r.asset?.itemDescription ?? '—'}</td>
          <td className={tdClass}>{formatDateTime(r.createdAt)}</td>
          <td className={tdClass}><StatusChip status={REQUEST_STATUS_LABEL[r.status]} tone={REQUEST_STATUS_TONE[r.status]} /></td>
          <td className={`${tdClass} text-right`}><SecondaryButton onClick={() => setViewing(r)}>View</SecondaryButton></td>
        </tr>)}
        {requests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">You have not filed any return or incident requests.</td></tr>}
      </tbody></table></TableWrap>
    </Panel>}

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
    <CenteredModal open={Boolean(replacing)} title={replacing ? `Replace ${replacing.itemDescription}` : 'Request replacement'} description="Pick the replacement item. The request goes to your Approving Officer, then the custodian issues it and collects your current unit." onClose={() => setReplacing(null)}>
      {replacing && <RequisitionForm key={replacing.id} replacing={replacing} onSubmit={(created) => { setReplacing(null); notify(`${created.requestNumber} submitted for approval.`); void load(); }} />}
    </CenteredModal>
    <DetailDrawer open={Boolean(viewing)} title={viewing?.requestNumber ?? 'Request'} onClose={() => setViewing(null)}>
      {viewing && <div className="space-y-4">
        <AssetRequestDetail request={viewing} audience="requester" />
        {isOpen(viewing) && <SecondaryButton onClick={() => setCancelling(viewing)}>Cancel request</SecondaryButton>}
      </div>}
    </DetailDrawer>
    <ConfirmDialog open={Boolean(cancelling)} title={`Cancel ${cancelling?.requestNumber ?? ''}?`} detail="The custodian will be notified that you no longer need this request." confirmLabel="Cancel request" cancelLabel="Keep request" onConfirm={() => void confirmCancel()} onCancel={() => setCancelling(null)} />
    <Toast message={toast} />
  </div>;
}

function AssetCard({
  asset,
  requests,
  canRequestReplacement,
  onFile,
  onReplace,
  onView,
  onCancel,
}: Readonly<{
  asset: MyAsset;
  requests: AssetRequest[];
  canRequestReplacement: boolean;
  onFile: (type: AssetRequestType) => void;
  onReplace: () => void;
  onView: (r: AssetRequest) => void;
  onCancel: (r: AssetRequest) => void;
}>) {
  const open = requests.filter(isOpen);
  const issued = asset.status === 'issued';
  const { replacement } = asset;
  const replaceBlocked = replacement.openRequestNumber
    ? `${replacement.openRequestNumber} already requests a replacement for this asset`
    : (replacement.eligible ? undefined : replacement.reason);

  return <article className="border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-base font-bold text-slate-950">{asset.itemDescription}</p><p className="mt-1 text-xs text-slate-500">{[asset.propertyNumber, asset.serialNumber && `Serial ${asset.serialNumber}`].filter(Boolean).join(' · ') || asset.assetType}</p></div><StatusChip status={asset.condition.replaceAll('_', ' ')} /></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{[['Status', humanize(asset.status)], ['Expected return', asset.expectedReturnDate ? formatDate(asset.expectedReturnDate) : 'No fixed date'], ['Type', `${asset.assetType} · ${asset.assetClass}`], ['Location', locationLabel(asset)]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-800">{value}</dd></div>)}</dl>
    {open.map((r) => <div key={r.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
      <span><span className="font-bold text-amber-900">{REQUEST_TYPE_LABEL[r.type]}</span> <span className="text-amber-800">· {r.requestNumber} · {REQUEST_STATUS_LABEL[r.status]}{r.handoverDate ? ` · bring it in ${formatDate(r.handoverDate)}` : ''}</span></span>
      <span className="flex gap-2"><button type="button" onClick={() => onView(r)} className="text-xs font-bold text-blue-700 hover:underline">View</button><button type="button" onClick={() => onCancel(r)} className="text-xs font-bold text-red-700 hover:underline">Cancel request</button></span>
    </div>)}
    {replacement.openRequestNumber && <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"><span className="font-bold">Replacement requested</span> · {replacement.openRequestNumber} — track it in My Requisitions.</div>}
    {!issued && <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{repairNote(asset) ?? HOLDING_NOTE[asset.status] ?? 'Requests can be filed only while the asset is issued to you.'}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {REQUEST_BUTTONS.map(({ type, label }) => {
        const blocker = blockingRequest(type, requests);
        return <span key={type} title={blocker ? `${blocker.requestNumber} is still open for this asset` : undefined}><SecondaryButton disabled={!issued || Boolean(blocker)} onClick={() => onFile(type)}>{label}</SecondaryButton></span>;
      })}
      {canRequestReplacement && <span title={replaceBlocked}><SecondaryButton icon={RefreshCcw} disabled={Boolean(replaceBlocked)} onClick={onReplace}>Request replacement</SecondaryButton></span>}
    </div>
    {canRequestReplacement && replacement.eligible && !replacement.openRequestNumber && <p className="mt-2 text-xs text-slate-500">Eligible for replacement: {replacement.reason}</p>}
  </article>;
}
