'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RequisitionForm } from '@/components/requisitions/RequisitionForm';
import { RequisitionDetailView, SlaBadge } from '@/components/requisitions/RequisitionDetailView';
import { requisitionItemsLabel } from '@/lib/requisitions/catalogue-items';
import { formatDate, requesterLabel, requisitionStatusLabel } from '@/lib/requisitions/requisition-view';
import { rowActionMode } from '@/lib/workflow/row-action';
import { detailActions, rowActionLabel } from '@/lib/workflow/actions';
import { assetApiToRow, humanize, unitAssets, type AssetRow } from '@/lib/workflow/asset-rows';
import { DEFAULT_REQUISITION_SORT, REQUISITION_SORT_OPTIONS, compareRequisitionRows } from '@/lib/workflow/requisition-sort';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { FilterBar } from '@/components/ui/FilterBar';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { normalizeWorkflowSlug } from '@/lib/workflow/live-pages';
import { ProposedUserRole, proposedRoleLabels } from '@/lib/roles/proposed-roles';
import { useAuth } from '@/lib/auth/use-auth';

type Row = AssetRow;

// The pages this component serves - exactly the ones lib/workflow/live-pages.ts lets
// the role routers hand it. Every one reads real records and every action saves.
const pageCopy: Record<string, { title: string; detail: string; action?: string }> = {
  requisitions: {
    title: 'My Requisitions',
    detail: 'Track the status, timeline and documents of the requisitions you have submitted.',
    action: 'Create Requisition',
  },
  approvals: {
    title: 'Approval Queue',
    detail: 'Review the requests routed to you and approve or reject them. Each decision is saved and recorded in the audit trail.',
  },
  fulfillment: {
    title: 'Requisition Fulfillment',
    detail: 'Fulfil approved requests, or put them on hold when the item is unavailable. Each action is saved and recorded in the audit trail.',
  },
  custody: {
    title: 'Custody & Issuance',
    detail: 'See who holds each asset, then issue it, transfer it or take it back. Every change is saved and recorded in the audit trail. Supplies are not listed here — they are issued from stock through Requisition Fulfillment.',
  },
  disposal: {
    title: 'Disposal Recommendations',
    detail: 'Flag an asset for disposal with a documented justification. The Property Officer reviews it; the disposal itself is carried out through the manual COA process.',
  },
};

function requisitionApiToRow(request: Requisition): Row {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    requesterId: request.requestedById,
    requester: requesterLabel(request.requester),
    item: requisitionItemsLabel(request.items),
    requestType: request.requisitionType,
    quantity: request.items.reduce((sum, i) => sum + i.quantity, 0),
    status: request.status,
    submittedDate: request.submittedAt,
    requiredDate: request.requiredDate,
    justification: request.justification,
    remarks: request.supervisorComments ?? '',
  };
}

// `openId` - a requisition to open in the detail drawer on arrival (the page's
// `?open=` param), used when a notification deep-links into a queue.
export function WorkflowPage({ role, slug, openId }: Readonly<{ role: ProposedUserRole; slug: string; openId?: string }>) {
  const { user: currentUser } = useAuth();
  const normalizedSlug = normalizeWorkflowSlug(slug);
  const content = pageCopy[normalizedSlug] ?? { title: 'Workspace', detail: '' };
  const isCustodian = role === ProposedUserRole.IT_ASSET_CUSTODIAN || role === ProposedUserRole.PROPERTY_CUSTODIAN;
  const isApprovalsPage = role === ProposedUserRole.APPROVING_OFFICER && normalizedSlug === 'approvals';
  const isFulfillmentPage = isCustodian && normalizedSlug === 'fulfillment';
  const isCustodyPage = isCustodian && normalizedSlug === 'custody';
  const isDisposalPage = isCustodian && normalizedSlug === 'disposal';
  // "My Requisitions": the header button opens the shared RequisitionForm
  // (POST /v1/requisitions).
  const isMyRequisitions = normalizedSlug === 'requisitions';
  const isRequisitionPage = isApprovalsPage || isFulfillmentPage || isMyRequisitions;
  const isAssetPage = isCustodyPage || isDisposalPage;
  // Where an asset's full record (details, lifecycle, QR, history) lives for this role.
  const assetRecordBase = role === ProposedUserRole.IT_ASSET_CUSTODIAN ? '/it-asset-custodian/assets' : '/property-custodian/assets';

  const [creatingRequisition, setCreatingRequisition] = useState(false);
  // Requisition pages keep the full API objects so the table and drawer can show
  // REQ numbers, people, SLA and the real timeline - the flat Row shape only
  // carries what search/sort need.
  const [requisitionById, setRequisitionById] = useState<Record<string, Requisition>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // This component does client-side search/sort/filter over `rows`, which requires the
  // full matching working set in memory - a single server page wouldn't search/sort
  // correctly against data it doesn't have. Fetching a large single page (rather than
  // defaulting to the API's page size of 15) is the pragmatic fix here; true server-side
  // pagination would need this component's search/sort to move server-side too.
  const LIVE_FETCH_LIMIT = 200;
  const [liveFetchTruncated, setLiveFetchTruncated] = useState(false);

  const fetchLiveRows = useCallback((): Promise<void> => {
    if (isCustodyPage) {
      return assetsApi.list(1, LIVE_FETCH_LIMIT).then((res) => {
        setRows(unitAssets(res.data.data).map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
    if (isDisposalPage) {
      return assetsApi.list(1, LIVE_FETCH_LIMIT, undefined, 'available').then((res) => {
        setRows(res.data.data.map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
    // Fulfillment is not narrowed to 'pending_fulfillment': the backend already
    // scopes custodians to pending_fulfillment + on_hold, and filtering further
    // made on-hold requests vanish from the only page that can fulfil them.
    const fetcher = isFulfillmentPage || isApprovalsPage
      ? requisitionsApi.list(1, LIVE_FETCH_LIMIT)
      : requisitionsApi.mine(1, LIVE_FETCH_LIMIT);
    return fetcher.then((res) => {
      setRequisitionById(Object.fromEntries(res.data.data.map((r) => [r.id, r])));
      setRows(res.data.data.map(requisitionApiToRow));
      setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
    });
  }, [isCustodyPage, isDisposalPage, isFulfillmentPage, isApprovalsPage]);

  const [liveFetchError, setLiveFetchError] = useState('');

  useEffect(() => {
    fetchLiveRows()
      .then(() => setLiveFetchError(''))
      .catch(() => setLiveFetchError('Failed to load data. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, [fetchLiveRows]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState<string>(isRequisitionPage ? DEFAULT_REQUISITION_SORT : 'item');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);

  // Notification deep-link: once the queue has loaded, fetch the requested
  // record and open its drawer. Fetching by id (rather than only looking in the
  // loaded queue) means the click still lands when the request is no longer in
  // this queue - already decided, or the user's own - and the drawer's actions
  // are status-gated, so nothing stale is offered.
  const handledOpenId = useRef<string | null>(null);
  useEffect(() => {
    if (!openId || !isRequisitionPage || loading || handledOpenId.current === openId) return;
    handledOpenId.current = openId;
    requisitionsApi
      .getOne(openId)
      .then((res) => {
        setRequisitionById((current) => ({ ...current, [res.data.id]: res.data }));
        setSelected(requisitionApiToRow(res.data));
      })
      .catch(() => setLiveFetchError('That request could not be found, or you no longer have access to it.'));
  }, [openId, isRequisitionPage, loading]);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [remarks, setRemarks] = useState('');
  const [issueEmployeeId, setIssueEmployeeId] = useState('');
  const [issueExpectedReturnDate, setIssueExpectedReturnDate] = useState('');
  const [transferToLocation, setTransferToLocation] = useState('');
  // Replacement fulfilment: the available unit handed to the requester in the
  // same step (fulfil returns the old unit and issues this one).
  // Keyed by requisition so a stale list from another request never shows.
  const [replacementUnitList, setReplacementUnitList] = useState<{ requisitionId: string; units: Asset[] } | null>(null);
  const [replacementUnitId, setReplacementUnitId] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const statuses = ['All', ...Array.from(new Set(rows.map((row) => String(row.status ?? 'Open'))))];
  const pageSize = 6;

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .filter((row) => statusFilter === 'All' || String(row.status) === statusFilter)
      .filter((row) => Object.values(row).join(' ').toLowerCase().includes(q))
      .sort((a, b) => isRequisitionPage
        ? compareRequisitionRows(sortKey, a, b)
        : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')));
  }, [rows, search, statusFilter, sortKey, isRequisitionPage]);

  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };


  const submitApprovalDecision = async (action: 'Approve' | 'Reject') => {
    if (!selected || actionSubmitting) return;
    const trimmedRemarks = remarks.trim();
    if (action === 'Reject' && !trimmedRemarks) {
      setErrors({ remarks: 'Rejection reason is required.' });
      return;
    }
    setActionSubmitting(true);
    try {
      const id = String(selected.id);
      if (action === 'Approve') {
        await requisitionsApi.approve(id, trimmedRemarks || undefined);
      } else {
        await requisitionsApi.reject(id, trimmedRemarks);
      }
      setConfirmAction(null);
      setSelected(null);
      setRemarks('');
      setErrors({});
      notify(action === 'Approve' ? 'Requisition approved.' : 'Requisition rejected.');
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch {
      notify(`Failed to ${action.toLowerCase()} the requisition. Please try again.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  const selectedRequisition = selected ? requisitionById[String(selected.id)] : undefined;
  const replacementLine = selectedRequisition?.requisitionType === 'replacement' ? selectedRequisition.items[0] : undefined;
  const pickingReplacementUnit = confirmAction === 'Fulfill' && isFulfillmentPage && Boolean(replacementLine);

  const pickingForId = pickingReplacementUnit ? selectedRequisition?.id : undefined;
  const replacementUnits = pickingForId && replacementUnitList?.requisitionId === pickingForId ? replacementUnitList.units : null;

  useEffect(() => {
    if (!pickingForId || !replacementLine) return;
    let live = true;
    const replacedId = selectedRequisition?.replacedAsset?.id;
    assetsApi
      .list(1, 100, undefined, 'available', replacementLine.assetType)
      .then((res) => { if (live) setReplacementUnitList({ requisitionId: pickingForId, units: res.data.data.filter((a) => a.assetClass !== 'IES' && a.id !== replacedId) }); })
      .catch(() => { if (live) setReplacementUnitList({ requisitionId: pickingForId, units: [] }); });
    return () => { live = false; };
  }, [pickingForId, replacementLine, selectedRequisition?.replacedAsset?.id]);

  // Custodian fulfilment queue: fulfil (optionally issuing the replacement unit) or hold,
  // through the requisitions API.
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
        const line = requisitionById[id]?.requisitionType === 'replacement' ? requisitionById[id]?.items[0] : undefined;
        await requisitionsApi.fulfill(id, line && replacementUnitId ? { fulfilledItems: [{ requisitionItemId: line.id, assetId: replacementUnitId }] } : {});
      } else {
        await requisitionsApi.hold(id, trimmedRemarks);
      }
      setConfirmAction(null);
      setSelected(null);
      setRemarks('');
      setErrors({});
      notify(action === 'Fulfill' ? (replacementUnitId ? 'Requisition fulfilled — replacement unit issued.' : 'Requisition fulfilled.') : 'Requisition placed on hold.');
      setReplacementUnitId('');
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      notify(Array.isArray(msg) ? msg.join(' · ') : (msg ?? `Failed to ${action === 'Fulfill' ? 'fulfill' : 'place on hold'} the requisition. Please try again.`));
    } finally {
      setActionSubmitting(false);
    }
  };

  // Custody & Issuance: moves the asset through the lifecycle API. Two of the three
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
        expectedReturnDate: action === 'Issue' ? (issueExpectedReturnDate || undefined) : undefined,
      });
      setConfirmAction(null);
      setSelected(null);
      setIssueEmployeeId('');
      setIssueExpectedReturnDate('');
      setTransferToLocation('');
      setErrors({});
      const notifyMessage = { Issue: 'Asset issued.', Transfer: 'Asset transferred.', Return: 'Asset returned.' } as const;
      notify(notifyMessage[action]);
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      notify(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to complete this action. Please try again.'));
    } finally {
      setActionSubmitting(false);
    }
  };

  // Disposal recommendation: flags the asset through the lifecycle API. Reuses the
  // remarks textarea - a disposal flag needs a documented justification (CLAUDE.md §6
  // Module 1). Repairs are closed from the
  // Maintenance & Repair queue (RepairQueue), not here.
  const submitDisposalRecommendation = async () => {
    if (!selected || actionSubmitting) return;
    const trimmedRemarks = remarks.trim();
    if (!trimmedRemarks) {
      setErrors({ remarks: 'A justification is required to recommend disposal.' });
      return;
    }
    setActionSubmitting(true);
    try {
      await assetsApi.updateLifecycle(String(selected.id), { status: 'flagged_for_disposal', notes: trimmedRemarks });
      setConfirmAction(null);
      setSelected(null);
      setRemarks('');
      setErrors({});
      notify('Disposal recommended.');
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      notify(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to complete this action. Please try again.'));
    } finally {
      setActionSubmitting(false);
    }
  };

  // Nobody approves their own request - the backend refuses it, so don't offer it.
  const selectedIsSelfApproval = isApprovalsPage && selected?.requesterId === currentUser?.id;

  if (loading) return <LoadingSkeleton rows={8} />;

  const selectedRequisitionDetail = isRequisitionPage && selected ? requisitionById[String(selected.id)] : undefined;

  return (
    <div className="space-y-5">
      <Toast message={toast} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">{proposedRoleLabels[role]}</p>
          <h1 className="text-2xl font-bold text-slate-950">{content.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{content.detail}</p>
        </div>
        {isMyRequisitions && content.action && (
          <button
            type="button"
            onClick={() => setCreatingRequisition(true)}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800"
          >
            {content.action}
          </button>
        )}
      </div>

      {liveFetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {liveFetchError}
        </div>
      )}

      {liveFetchTruncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Showing the first {LIVE_FETCH_LIMIT} records. There may be more — narrow your search to find items beyond this list.
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          { label: 'Status', value: statusFilter, options: statuses, onChange: (value) => { setStatusFilter(value); setPage(1); } },
          {
            label: 'Sort',
            value: sortKey,
            options: isRequisitionPage ? [...REQUISITION_SORT_OPTIONS] : ['item', 'status', 'heldBy', 'location'],
            onChange: (value) => { setSortKey(value); setPage(1); },
          },
        ]}
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">{isRequisitionPage ? 'Request' : 'Asset'}</th>
                <th className="px-4 py-3">{isRequisitionPage ? 'Requested by' : 'Held by'}</th>
                <th className="px-4 py-3">{isRequisitionPage ? 'Required by' : 'Location'}</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleRows.map((row) => {
                const liveReq = isRequisitionPage ? requisitionById[String(row.id)] : undefined;
                return (
                <tr key={String(row.id)} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-950">{String(row.item ?? row.id)}</p>
                    <p className="text-xs text-slate-500">
                      {isAssetPage
                        ? [row.propertyNumber, row.serialNumber && `S/N ${String(row.serialNumber)}`].filter(Boolean).join(' · ')
                        : String(row.requestNumber ?? row.id)}
                    </p>
                  </td>
                  {isAssetPage && (
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{String(row.heldBy)}</p>
                      {row.dueBack ? (
                        <p className={`text-xs ${row.overdue ? 'font-bold text-red-600' : 'text-slate-500'}`}>
                          {String(row.dueBack)}{row.overdue ? ' · overdue' : ''}
                        </p>
                      ) : null}
                    </td>
                  )}
                  {isAssetPage && <td className="px-4 py-3 text-slate-600">{String(row.location ?? '-')}</td>}
                  {liveReq && (
                    <>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{liveReq.requester?.name ?? 'Unknown requester'}</p>
                        <p className="text-xs text-slate-500">{[liveReq.requester?.employeeId, liveReq.requester?.officeOrSection, liveReq.requisitionType].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{formatDate(liveReq.requiredDate)}</p>
                        <SlaBadge request={liveReq} />
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3"><StatusBadge status={String(row.status ?? 'Open')} label={liveReq ? requisitionStatusLabel(liveReq.status) : undefined} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setSelected(row)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">View</button>
                      <button type="button" onClick={() => { setSelected(row); if (rowActionMode(normalizedSlug) === 'confirm') setConfirmAction(rowActionLabel(normalizedSlug)); }} className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800">
                        {rowActionLabel(normalizedSlug)}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No records match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>Page {page} of {totalPages} • {filteredRows.length} records</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40">Previous</button>
            <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-md border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      <DetailDrawer open={Boolean(selected)} title={String(selectedRequisitionDetail?.requestNumber ?? selected?.item ?? 'Record')} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            {selectedRequisitionDetail && <RequisitionDetailView request={selectedRequisitionDetail} />}
            {isAssetPage && (
              <>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {([
                    ['Property no.', selected.propertyNumber],
                    ['Serial no.', selected.serialNumber],
                    ['Status', humanize(String(selected.status))],
                    ['Condition', humanize(String(selected.condition))],
                    ['Held by', selected.heldBy],
                    ['Due back', selected.returnDate ? `${String(selected.returnDate)}${selected.overdue ? ' — overdue' : ''}` : '—'],
                    ['Location', selected.location],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt>
                      <dd className="mt-1 text-sm text-slate-900">{String(value ?? '-')}</dd>
                    </div>
                  ))}
                </dl>
                <Link href={`${assetRecordBase}/${String(selected.id)}`} className="inline-block text-sm font-bold text-blue-700 hover:underline">
                  Open the full asset record — history, QR code and lifecycle
                </Link>
              </>
            )}
            {selectedIsSelfApproval && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                This is your own request, so you can&apos;t approve or reject it. It is routed to another approver.
              </p>
            )}
            {!selectedIsSelfApproval && (
              <div className="flex flex-wrap gap-2">
                {detailActions(normalizedSlug, String(selected.status ?? '')).map((action) => (
                  <button key={action} type="button" onClick={() => setConfirmAction(action)} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={`${confirmAction} record`}
        detail="This updates the real record and is written to the audit trail."
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovalsPage && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
          } else if (isFulfillmentPage && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
          } else if (isCustodyPage && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) {
            void submitCustodyDecision(confirmAction);
          } else if (isDisposalPage && confirmAction === 'Recommend Disposal') {
            void submitDisposalRecommendation();
          }
        }}
        onCancel={() => { setConfirmAction(null); setRemarks(''); setErrors({}); setIssueEmployeeId(''); setIssueExpectedReturnDate(''); setTransferToLocation(''); setReplacementUnitId(''); }}
      >
        {pickingReplacementUnit && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Replacement unit to issue</span>
            <select value={replacementUnitId} onChange={(event) => setReplacementUnitId(event.target.value)} disabled={replacementUnits === null} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">{replacementUnits === null ? 'Loading available units…' : 'Issue later from Custody & Issuance'}</option>
              {(replacementUnits ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>{[unit.itemDescription, unit.propertyNumber, unit.serialNumber && `S/N ${unit.serialNumber}`].filter(Boolean).join(' · ')}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {replacementUnits && replacementUnits.length === 0
                ? `No available ${replacementLine?.assetType ?? ''} unit — fulfil now and issue one later, or put the request on hold.`
                : 'The old unit is taken back and this one is issued to the requester in the same step.'}
            </span>
          </label>
        )}
        {((isApprovalsPage && confirmAction === 'Reject') ||
          (isFulfillmentPage && confirmAction === 'On Hold') ||
          (isDisposalPage && confirmAction === 'Recommend Disposal')) && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Remarks</span>
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 h-24 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.remarks && <span className="mt-1 block text-xs text-red-600">{errors.remarks}</span>}
          </label>
        )}
        {isCustodyPage && confirmAction === 'Issue' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Recipient Employee ID</span>
            <input type="text" value={issueEmployeeId} onChange={(event) => setIssueEmployeeId(event.target.value)} placeholder="e.g. CICC-0042" className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.employeeId && <span className="mt-1 block text-xs text-red-600">{errors.employeeId}</span>}
          </label>
        )}
        {isCustodyPage && confirmAction === 'Issue' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Expected return date (optional)</span>
            <input type="date" value={issueExpectedReturnDate} onChange={(event) => setIssueExpectedReturnDate(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
        )}
        {isCustodyPage && confirmAction === 'Transfer' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Receiving Office / Section</span>
            <input type="text" value={transferToLocation} onChange={(event) => setTransferToLocation(event.target.value)} placeholder="e.g. Cybercrime Operations Division" className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.toLocation && <span className="mt-1 block text-xs text-red-600">{errors.toLocation}</span>}
          </label>
        )}
      </ConfirmDialog>

      <CenteredModal open={creatingRequisition} title="New requisition" description="Choose an item from inventory and provide the justification for approval." onClose={() => setCreatingRequisition(false)}>
        {creatingRequisition && (
          <RequisitionForm
            onSubmit={(created) => {
              setCreatingRequisition(false);
              notify(`${created.requestNumber} was submitted for approval.`);
              void fetchLiveRows().catch(() => notify('Submitted, but the list failed to refresh — reload the page to see it.'));
            }}
          />
        )}
      </CenteredModal>
    </div>
  );
}
