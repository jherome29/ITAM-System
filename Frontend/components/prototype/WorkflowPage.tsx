'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RequisitionForm } from '@/components/requisitions/RequisitionForm';
import { RecordPrints, usePrintPrompt } from '@/components/shared/RecordPrints';
import { CustodyPaperCopy } from '@/components/assets/CustodyPaperCopy';
import { FulfillmentHandover } from '@/components/requisitions/FulfillmentHandover';
import { IssuedSupplies } from '@/components/requisitions/IssuedSupplies';
import { AssetRequestQueue } from '@/components/asset-requests/AssetRequestQueue';
import { RequisitionDetailView, SlaBadge } from '@/components/requisitions/RequisitionDetailView';
import { requisitionItemsLabel } from '@/lib/requisitions/catalogue-items';
import {
  defaultStockId,
  fulfilledItemsFor,
  isSupplyLine,
  stockOptionsFor,
  stockProblem,
  type StockOption,
} from '@/lib/requisitions/supply-stock';
import { formatDate, requesterLabel, requisitionStatusLabel } from '@/lib/requisitions/requisition-view';
import { rowActionMode } from '@/lib/workflow/row-action';
import { detailActions, rowActionLabel } from '@/lib/workflow/actions';
import { assetApiToRow, humanize, unitAssets, type AssetRow } from '@/lib/workflow/asset-rows';
import { DEFAULT_REQUISITION_SORT, REQUISITION_SORT_OPTIONS, compareRequisitionRows } from '@/lib/workflow/requisition-sort';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { SearchToolbar } from '@/components/ui/SearchToolbar';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { normalizeWorkflowSlug } from '@/lib/workflow/live-pages';
import { ProposedUserRole, proposedRoleLabels } from '@/lib/roles/proposed-roles';
import { useAuth } from '@/lib/auth/use-auth';
import { DateField } from '@/components/ui/DateField';
import { controlClass, textareaClass } from '@/components/ui/controls';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton, tdClass, thClass } from '@/components/admin/AdminUi';
import { buttonClass } from '@/components/ui/buttons';
import { Notice } from '@/components/ui/Notice';
import { EmptyRow } from '@/components/ui/EmptyRow';
import { ClampText } from '@/components/ui/ClampText';
import { Pager } from '@/components/ui/Pager';
import { DEFAULT_PAGE_SIZE, clampPage, pageSlice } from '@/lib/pagination';

// The custody pages sort asset rows by one of these keys; the requisition pages have their own list.
const ASSET_SORT_KEYS = ['item', 'status', 'heldBy', 'location'] as const;
const SORT_LABEL: Record<string, string> = { issuedNewest: 'Issued date: Newest first', issuedOldest: 'Issued date: Oldest first', item: 'Item', status: 'Status', heldBy: 'Held by', location: 'Location' };

type Row = AssetRow;

function compareIssuedDates(a: Row, b: Row, sort: string) {
  const aDate = Date.parse(String(a.lastIssuedAt ?? ''));
  const bDate = Date.parse(String(b.lastIssuedAt ?? ''));
  if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
    return Number(Number.isNaN(aDate)) - Number(Number.isNaN(bDate));
  }
  return sort === 'issuedNewest' ? bDate - aDate : aDate - bDate;
}

type PageCopy = { title: string; detail: string; action?: string };

// The System Administrator's version of Requisition Fulfillment: only what a
// custodian filed themselves, which segregation of duties keeps out of their queue.
const ADMIN_FULFILMENT_COPY: PageCopy = {
  title: 'Requisition Fulfillment (fallback)',
  detail: 'Requisitions filed by the custodian who would fulfill them. They cannot fulfill their own, so you do - fulfill it, or put it on hold when the item is unavailable. Each action is saved and recorded in the audit trail.',
};

// The pages this component serves - exactly the ones lib/workflow/live-pages.ts lets
// the role routers hand it. Every one reads real records and every action saves.
const pageCopy: Record<string, PageCopy> = {
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
    detail: 'Fulfill approved requests, or put them on hold when the item is unavailable. Each action is saved and recorded in the audit trail.',
  },
  custody: {
    title: 'Custody & Issuance',
    detail: 'See who holds each asset, then issue it, transfer it or take it back. Every change is saved and recorded in the audit trail. Supplies are not listed here — they are issued from stock through Requisition Fulfillment.',
  },
  disposal: {
    title: 'Disposal Recommendations',
    detail: 'Review unserviceable assets flagged for disposal. Record completion after the approved disposal takes place.',
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
  const isAdminFulfilment = role === ProposedUserRole.MASTER_ADMIN && normalizedSlug === 'fulfillment';
  const content = isAdminFulfilment
    ? ADMIN_FULFILMENT_COPY
    : (pageCopy[normalizedSlug] ?? { title: 'Workspace', detail: '' });
  const isCustodian = role === ProposedUserRole.ASSET_CUSTODIAN;
  const isApprovalsPage = role === ProposedUserRole.APPROVING_OFFICER && normalizedSlug === 'approvals';
  const isFulfillmentPage = (isCustodian || isAdminFulfilment) && normalizedSlug === 'fulfillment';
  const isCustodyPage = isCustodian && normalizedSlug === 'custody';
  const [custodyTab, setCustodyTab] = useState<'ICT' | 'Fixed' | 'Supplies' | 'returns'>('ICT');
  const isDisposalPage = isCustodian && normalizedSlug === 'disposal';
  // "My Requisitions": the header button opens the shared RequisitionForm
  // (POST /v1/requisitions).
  const isMyRequisitions = normalizedSlug === 'requisitions';
  const isRequisitionPage = isApprovalsPage || isFulfillmentPage || isMyRequisitions;
  const isAssetPage = isCustodyPage || isDisposalPage;
  const isCustodianFulfillment = isCustodian && isFulfillmentPage;
  const usesCenteredRecord = isAssetPage || isCustodianFulfillment;
  const RecordDialog = usesCenteredRecord ? CenteredModal : DetailDrawer;
  // Where an asset's full record (details, lifecycle, QR, history) lives for this role.
  const assetRecordBase = '/asset-custodian/assets';

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
      return assetsApi.custody(1, LIVE_FETCH_LIMIT).then(async ({ data: first }) => {
        const assets = [...first.data];
        for (let page = 2; page <= (first.totalPages ?? 1); page++) {
          assets.push(...(await assetsApi.custody(page, LIVE_FETCH_LIMIT)).data.data);
        }
        setRows(unitAssets(assets).filter((asset) => asset.status !== 'returned').map(assetApiToRow));
        setLiveFetchTruncated(false);
      });
    }
    if (isDisposalPage) {
      return assetsApi.disposalQueue(1, LIVE_FETCH_LIMIT).then(async ({ data: first }) => {
        const assets = [...first.data];
        for (let page = 2; page <= (first.totalPages ?? 1); page++) {
          assets.push(...(await assetsApi.disposalQueue(page, LIVE_FETCH_LIMIT)).data.data);
        }
        setRows(assets.map(assetApiToRow));
        setLiveFetchTruncated(false);
      });
    }
    // Fulfillment is not narrowed to 'pending_fulfillment': the backend already
    // scopes custodians to pending_fulfillment + on_hold, and filtering further
    // made on-hold requests vanish from the only page that can fulfil them.
    const fetcher = isAdminFulfilment
      ? requisitionsApi.fulfilmentFallback()
      : isFulfillmentPage || isApprovalsPage
        ? requisitionsApi.list(1, LIVE_FETCH_LIMIT)
        : requisitionsApi.mine(1, LIVE_FETCH_LIMIT);
    return fetcher.then((res) => {
      setRequisitionById(Object.fromEntries(res.data.data.map((r) => [r.id, r])));
      setRows(res.data.data.map(requisitionApiToRow));
      setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
    });
  }, [isCustodyPage, isDisposalPage, isFulfillmentPage, isApprovalsPage, isAdminFulfilment]);

  const [liveFetchError, setLiveFetchError] = useState('');

  useEffect(() => {
    fetchLiveRows()
      .then(() => setLiveFetchError(''))
      .catch(() => setLiveFetchError('Could not load data. Please refresh the page.'))
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
  const [manageAsset, setManageAsset] = useState(false);
  const [disposal, setDisposal] = useState({ date: '', method: '', reference: '', confirmed: false });
  const disposalAssetId = isDisposalPage && selected ? String(selected.id) : null;
  const [assessment, setAssessment] = useState<{ id: string; reason: string }>();

  useEffect(() => {
    if (!disposalAssetId) return;
    let current = true;
    assetsApi.getOne(disposalAssetId).then(({ data }) => {
      const latest = data.locationHistory?.filter((entry) => entry.action === 'asset_flagged_disposal')
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
      if (current) setAssessment({ id: disposalAssetId, reason: latest?.notes || 'No assessment reason recorded.' });
    }).catch(() => {
      if (current) setAssessment({ id: disposalAssetId, reason: 'Could not load the assessment reason.' });
    });
    return () => { current = false; };
  }, [disposalAssetId]);
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
  // Supply fulfilment: the stock record each supply line is drawn from. null for
  // a line means the lookup failed (the server then resolves the record itself).
  const [supplyStock, setSupplyStock] = useState<{ requisitionId: string; options: Record<string, StockOption[] | null> } | null>(null);
  const [stockPicks, setStockPicks] = useState<Record<string, string>>({});
  const [actionSubmitting, setActionSubmitting] = useState(false);
  // CICC wants a paper copy after each step on a requisition; this asks right after one is saved.
  const { ask: askToPrint, prompt: printPrompt } = usePrintPrompt();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const statuses = ['All', ...Array.from(new Set(rows.map((row) => String(row.status ?? 'Open'))))];
  const pageSize = DEFAULT_PAGE_SIZE;

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .filter((row) => !isCustodyPage || row.assetType === custodyTab)
      .filter((row) => statusFilter === 'All' || String(row.status) === statusFilter)
      .filter((row) => Object.values(row).join(' ').toLowerCase().includes(q))
      .sort((a, b) => isRequisitionPage
        ? compareRequisitionRows(sortKey, a, b)
        : sortKey === 'issuedNewest' || sortKey === 'issuedOldest'
          ? compareIssuedDates(a, b, sortKey)
          : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')));
  }, [rows, search, statusFilter, sortKey, isRequisitionPage, isCustodyPage, custodyTab]);

  // Kept inside the list: finishing the last row of a page must not leave you on an empty one.
  const pageNo = clampPage(page, filteredRows.length, pageSize);
  const visibleRows = pageSlice(filteredRows, pageNo, pageSize);

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
      askToPrint('requisition', id, requisitionById[id]?.requestNumber ?? 'The requisition');
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch {
      notify(`Could not ${action.toLowerCase()} the requisition. Please try again.`);
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

  // Supply lines of the request being fulfilled. A supply leaves stock when the
  // request is fulfilled, so the custodian sees - and can change - which stock
  // record it comes out of. (Replacements are units, never supplies.)
  const supplyLines = useMemo(
    () => (confirmAction === 'Fulfill' && isFulfillmentPage && !replacementLine ? (selectedRequisition?.items ?? []).filter(isSupplyLine) : []),
    [confirmAction, isFulfillmentPage, replacementLine, selectedRequisition],
  );
  const supplyForId = supplyLines.length > 0 ? selectedRequisition?.id : undefined;
  const supplyOptions = supplyForId && supplyStock?.requisitionId === supplyForId ? supplyStock.options : null;

  useEffect(() => {
    if (!supplyForId) return;
    let live = true;
    Promise.all(
      supplyLines.map(async (line) => {
        try {
          const res = await assetsApi.list(1, 100, line.itemDescription, 'available', line.assetType, 'IES');
          return [line.id, stockOptionsFor(line, res.data.data)] as const;
        } catch {
          return [line.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (!live) return;
      setSupplyStock({ requisitionId: supplyForId, options: Object.fromEntries(entries) });
      setStockPicks(Object.fromEntries(entries.map(([lineId, options]) => [lineId, options ? defaultStockId(options) : ''])));
    });
    return () => { live = false; };
  }, [supplyForId, supplyLines]);

  /** The first reason a supply line cannot be drawn from stock, or null. A failed lookup never blocks: the server decides. */
  const supplyBlockedReason = supplyOptions
    ? supplyLines.map((line) => { const options = supplyOptions[line.id]; return options ? stockProblem(line, options, stockPicks[line.id] ?? '') : null; }).find(Boolean) ?? null
    : null;

  // Custodian fulfilment queue: fulfil (optionally issuing the replacement unit, or
  // drawing supplies from the chosen stock record) or hold, through the requisitions API.
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
      let drewFromStock = false;
      if (action === 'Fulfill') {
        const line = requisitionById[id]?.requisitionType === 'replacement' ? requisitionById[id]?.items[0] : undefined;
        const drawnFromStock = fulfilledItemsFor(requisitionById[id]?.items ?? [], stockPicks);
        drewFromStock = drawnFromStock.length > 0;
        const fulfilledItems = line && replacementUnitId ? [{ requisitionItemId: line.id, assetId: replacementUnitId }] : drawnFromStock;
        await requisitionsApi.fulfill(id, fulfilledItems.length > 0 ? { fulfilledItems } : {});
      } else {
        await requisitionsApi.hold(id, trimmedRemarks);
      }
      setConfirmAction(null);
      setSelected(null);
      setRemarks('');
      setErrors({});
      notify(
        action === 'Fulfill'
          ? replacementUnitId
            ? 'Requisition fulfilled — replacement unit issued.'
            : drewFromStock
              ? 'Requisition fulfilled — the quantity was drawn from stock.'
              : 'Requisition fulfilled.'
          : 'Requisition placed on hold.',
      );
      askToPrint('requisition', id, requisitionById[id]?.requestNumber ?? 'The requisition');
      setReplacementUnitId('');
      setStockPicks({});
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh — reload the page to see the latest queue.'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      notify(Array.isArray(msg) ? msg.join(' · ') : (msg ?? `Could not ${action === 'Fulfill' ? 'fulfill' : 'place on hold'} the requisition. Please try again.`));
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
      notify(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Could not complete this action. Please try again.'));
    } finally {
      setActionSubmitting(false);
    }
  };

  const submitDisposal = async () => {
    if (!disposalAssetId || actionSubmitting) return;
    const method = disposal.method.trim();
    const reference = disposal.reference.trim();
    if (!disposal.date || !method || !reference || !disposal.confirmed) {
      setErrors({ disposal: 'Enter all three details and confirm disposal is complete.' });
      return;
    }
    setActionSubmitting(true);
    try {
      await assetsApi.updateLifecycle(disposalAssetId, {
        status: 'disposed',
        disposalDate: disposal.date,
        disposalMethod: method,
        disposalReference: reference,
        disposalConfirmed: disposal.confirmed,
      });
      closeDisposalConfirmation();
      setSelected(null);
      notify('Disposal recorded.');
      await fetchLiveRows().catch(() => notify('Saved, but the list failed to refresh. Reload the page to see the latest queue.'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setErrors({ disposal: Array.isArray(msg) ? msg.join(' · ') : msg ?? 'Could not record disposal. Please try again.' });
    } finally {
      setActionSubmitting(false);
    }
  };

  const closeDisposalConfirmation = () => {
    setConfirmAction(null);
    setErrors({});
    setDisposal({ date: '', method: '', reference: '', confirmed: false });
  };

  // Nobody approves their own request - the backend refuses it, so don't offer it.
  const selectedIsSelfApproval = isApprovalsPage && selected?.requesterId === currentUser?.id;

  if (loading) return <LoadingSkeleton rows={8} />;

  const selectedRequisitionDetail = isRequisitionPage && selected ? requisitionById[String(selected.id)] : undefined;

  const handover = isCustodianFulfillment && confirmAction === 'Fulfill' && selectedRequisitionDetail &&
    !['replacement', 'repair'].includes(selectedRequisitionDetail.requisitionType) ? selectedRequisitionDetail : null;
  const custodyFacts = selected ? [
    ['Property number', String(selected.propertyNumber || 'Not recorded')],
    ['Serial number', String(selected.serialNumber || 'Not recorded')],
    ['Asset type', String(selected.assetType || 'Not recorded')],
    ['Location', String(selected.location || 'Not recorded')],
    ['Condition', humanize(String(selected.condition ?? ''))],
    ['Status', humanize(String(selected.status ?? ''))],
    ['Held by', String(selected.heldBy || 'Not issued')],
    ['Last issued', String(selected.issuedDateLabel || 'Not recorded')],
    ['Requisition no.', String(selected.lastIssuedFor || 'Not recorded')],
    ['Expected return', String(selected.returnDate || 'Not recorded')],
  ] as const : [];

  return (
    <div className="space-y-5">
      <Toast message={toast} />
      <PageHeader
        eyebrow={proposedRoleLabels[role]}
        title={content.title}
        detail={content.detail}
        action={isMyRequisitions && content.action ? <PrimaryButton onClick={() => setCreatingRequisition(true)}>{content.action}</PrimaryButton> : undefined}
      />

      {liveFetchError && (
        <Notice tone="red">{liveFetchError}</Notice>
      )}

      {liveFetchTruncated && (
        <Notice tone="amber">
          Showing the first {LIVE_FETCH_LIMIT} records. There may be more — narrow your search to find items beyond this list.
        </Notice>
      )}

      {isCustodyPage && (
        <div aria-label="Custody and issuance categories" className="flex flex-wrap gap-5 border-b border-slate-200">
          {([['ICT', 'ICT'], ['Fixed', 'Fixed Assets'], ['Supplies', 'Issued Supplies'], ['returns', 'Pending Returns']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={custodyTab === value}
              onClick={() => { setCustodyTab(value); setPage(1); setStatusFilter('All'); setSelected(null); }}
              className={'border-b-2 px-1 py-2.5 text-sm font-semibold ' + (custodyTab === value ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-600 hover:text-blue-700')}>
              {label}
            </button>
          ))}
        </div>
      )}
      {isCustodyPage && custodyTab === 'returns' ? (
        <AssetRequestQueue eyebrow="Asset Custodian" pendingReturns onReceived={() => {
          void fetchLiveRows().catch(() => notify('Return saved. Refresh to see the latest custody records.'));
        }} />
      ) : isCustodyPage && custodyTab === 'Supplies' ? <IssuedSupplies /> : <>
      <SearchToolbar
        value={search}
        onChange={(value) => { setSearch(value); setPage(1); }}
        placeholder="Search records"
        filters={[
          ...(!isDisposalPage ? [{ label: 'All statuses', value: statusFilter, options: statuses, onChange: (value: string) => { setStatusFilter(value); setPage(1); } }] : []),
          {
            label: 'Sort by',
            value: sortKey,
            options: (isRequisitionPage ? [...REQUISITION_SORT_OPTIONS] : isCustodyPage ? [...ASSET_SORT_KEYS, 'issuedNewest', 'issuedOldest'] : [...ASSET_SORT_KEYS]).map((key) => ({ value: key, label: `Sort: ${SORT_LABEL[key] ?? key}` })),
            onChange: (value) => { setSortKey(value); setPage(1); },
          },
        ]}
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {isCustodyPage && <th className={thClass}>Requisition no.</th>}
                <th className={thClass}>{isRequisitionPage ? 'Request' : 'Asset'}</th>
                {isCustodianFulfillment && <th className={thClass}>Requested item</th>}
                <th className={thClass}>{isRequisitionPage ? 'Requested by' : isDisposalPage ? 'Condition' : 'Held by'}</th>
                {isCustodyPage && <th className={thClass}>Issued date</th>}
                <th className={thClass}>{isRequisitionPage ? 'Required by' : 'Location'}</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const liveReq = isRequisitionPage ? requisitionById[String(row.id)] : undefined;
                return (
                <tr key={String(row.id)} className="hover:bg-blue-50/40">
                  {isCustodyPage && <td className={tdClass}>{String(row.lastIssuedFor ?? '—')}</td>}
                  <td className={tdClass}>
                    <p className="font-bold text-slate-950"><ClampText lines={2}>{String(isCustodianFulfillment ? row.requestNumber ?? row.id : row.item ?? row.id)}</ClampText></p>
                    {!isCustodianFulfillment && <p className="text-xs text-slate-500">
                      {isAssetPage
                        ? [row.propertyNumber, row.serialNumber && `S/N ${String(row.serialNumber)}`].filter(Boolean).join(' · ')
                        : String(row.requestNumber ?? row.id)}
                    </p>}
                  </td>
                  {isCustodianFulfillment && <td className={tdClass}><ClampText lines={2}>{String(row.item ?? '—')}</ClampText></td>}
                  {isDisposalPage && <td className={tdClass}>{row.condition ? humanize(String(row.condition)) : '—'}</td>}
                  {isCustodyPage && (
                    <td className={tdClass}>
                      <p className="font-semibold text-slate-800">{String(row.heldBy)}</p>
                      {row.dueBack ? (
                        <p className={`text-xs ${row.overdue ? 'font-bold text-red-600' : 'text-slate-500'}`}>
                          {String(row.dueBack)}{row.overdue ? ' · overdue' : ''}
                        </p>
                      ) : null}
                    </td>
                  )}
                  {isCustodyPage && <td className={tdClass}>{String(row.issuedDateLabel ?? 'Not recorded')}</td>}
                  {isAssetPage && <td className={tdClass}>{String(row.location ?? '-')}</td>}
                  {liveReq && (
                    <>
                      <td className={tdClass}>
                        <p className="font-semibold text-slate-800">{liveReq.requester?.name ?? 'Unknown requester'}</p>
                        <p className="text-xs text-slate-500">{[liveReq.requester?.employeeId, liveReq.requester?.officeOrSection, liveReq.requisitionType].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className={tdClass}>
                        <p>{formatDate(liveReq.requiredDate)}</p>
                        <SlaBadge request={liveReq} />
                      </td>
                    </>
                  )}
                  <td className={tdClass}><StatusBadge status={String(row.status ?? 'Open')} label={liveReq ? requisitionStatusLabel(liveReq.status) : undefined} /></td>
                  <td className={tdClass}>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setManageAsset(false); setSelected(row); }} className={buttonClass({ variant: 'secondary', size: 'sm' })}>View</button>
                      <button type="button" onClick={() => { setManageAsset(isAssetPage); setSelected(row); if (!isCustodianFulfillment && rowActionMode(normalizedSlug) === 'confirm') setConfirmAction(rowActionLabel(normalizedSlug)); }} className={buttonClass({ size: 'sm' })}>
                        {isCustodianFulfillment ? 'Manage' : rowActionLabel(normalizedSlug)}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <EmptyRow colSpan={isCustodyPage ? 7 : isCustodianFulfillment ? 6 : 5}>{search || statusFilter !== 'All' ? 'No records match the current filters.' : 'Nothing here yet.'}</EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pageNo} total={filteredRows.length} pageSize={pageSize} onPage={setPage} noun="records" />
      </section>
      </>}

      <RecordDialog open={Boolean(selected) && !handover} title={String(selectedRequisitionDetail?.requestNumber ?? selected?.item ?? 'Record')} onClose={() => setSelected(null)} inactive={Boolean(confirmAction)}>
        {selected && (
          <div className="space-y-4">
            {selectedRequisitionDetail && <RequisitionDetailView request={selectedRequisitionDetail} fulfillment={isCustodianFulfillment} />}
            {isAssetPage && (
              <>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(isCustodyPage ? custodyFacts : [
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
            {isCustodyPage && manageAsset && (selected.lastIssuedRequisitionId
              ? <RecordPrints key={String(selected.lastIssuedRequisitionId)} kind="requisition" recordId={String(selected.lastIssuedRequisitionId)} stacked />
              : <CustodyPaperCopy key={String(selected.id)} item={String(selected.item)} fields={custodyFacts} />)}
            {disposalAssetId && (
              <section className="rounded-lg border border-slate-200 p-3">
                <h3 className="text-sm font-semibold text-slate-950">Assessment reason</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {assessment?.id === disposalAssetId ? assessment.reason : 'Loading assessment…'}
                </p>
              </section>
            )}
            {selectedIsSelfApproval && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                This is your own request, so you can&apos;t approve or reject it. It is routed to another approver.
              </p>
            )}
            {!selectedIsSelfApproval && (!isDisposalPage || manageAsset) && (
              <div className="flex flex-wrap gap-2">
                {detailActions(normalizedSlug, String(selected.status ?? ''), String(selected.condition ?? '')).map((action) => (
                  <button key={action} type="button" onClick={() => setConfirmAction(action)} className={buttonClass()}>
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </RecordDialog>

      {handover && (
        <FulfillmentHandover key={handover.id} id={handover.id} requestNumber={handover.requestNumber}
          onClose={() => setConfirmAction(null)}
          onFulfilled={() => {
            setConfirmAction(null);
            setSelected(null);
            notify('Handover recorded. See Custody & Issuance for the updated records.');
            askToPrint('requisition', handover.id, handover.requestNumber);
            void fetchLiveRows().catch(() => notify('Handover recorded. Refresh to see the latest queue.'));
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmAction) && !handover}
        title={isDisposalPage ? 'Record Disposal' : `${confirmAction} record`}
        detail={isDisposalPage ? 'Enter the details of the completed, authorized disposal.' : 'The change is saved immediately and written to the audit trail.'}
        confirmLabel={actionSubmitting ? 'Processing…' : (confirmAction ?? 'Confirm')}
        confirmDisabled={actionSubmitting || (supplyLines.length > 0 && (supplyOptions === null || Boolean(supplyBlockedReason)))}
        onConfirm={() => {
          if (!confirmAction) return;
          if (isApprovalsPage && (confirmAction === 'Approve' || confirmAction === 'Reject')) {
            void submitApprovalDecision(confirmAction);
          } else if (isFulfillmentPage && (confirmAction === 'Fulfill' || confirmAction === 'On Hold')) {
            void submitFulfillmentDecision(confirmAction);
          } else if (isCustodyPage && (confirmAction === 'Issue' || confirmAction === 'Transfer' || confirmAction === 'Return')) {
            void submitCustodyDecision(confirmAction);
          } else if (isDisposalPage && confirmAction === 'Record Disposal') {
            void submitDisposal();
          }
        }}
        onCancel={isDisposalPage ? () => { if (!actionSubmitting) closeDisposalConfirmation(); } : () => { setConfirmAction(null); setRemarks(''); setErrors({}); setIssueEmployeeId(''); setIssueExpectedReturnDate(''); setTransferToLocation(''); setReplacementUnitId(''); setStockPicks({}); }}
      >
        {supplyLines.map((line) => {
          const options = supplyOptions?.[line.id];
          const chosen = options?.find((option) => option.id === stockPicks[line.id]);
          const problem = options ? stockProblem(line, options, stockPicks[line.id] ?? '') : null;
          return (
            <label key={line.id} className="block text-sm font-semibold text-slate-700">
              <span>Draw {line.quantity} × {line.itemDescription} from stock</span>
              <select
                value={stockPicks[line.id] ?? ''}
                onChange={(event) => setStockPicks((current) => ({ ...current, [line.id]: event.target.value }))}
                disabled={options === undefined || options === null || options.length === 0}
                className={`${controlClass} mt-2`}
              >
                {options === undefined && <option value="">Loading stock…</option>}
                {options === null && <option value="">Stock could not be loaded — the system will pick the oldest record</option>}
                {options && options.length === 0 && <option value="">No stock on record</option>}
                {options && options.length > 0 && !stockPicks[line.id] && <option value="">Choose a stock record…</option>}
                {(options ?? []).map((option) => (
                  <option key={option.id} value={option.id} disabled={!option.enough}>{option.label}{option.enough ? '' : ' — not enough'}</option>
                ))}
              </select>
              <span className={`mt-1 block text-xs font-normal ${problem ? 'text-red-600' : 'text-slate-500'}`}>
                {problem ?? (chosen ? `${chosen.onHand} on hand → ${chosen.remaining} left after this fulfillment.` : 'The quantity leaves stock when you fulfill.')}
              </span>
            </label>
          );
        })}
        {pickingReplacementUnit && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Replacement unit to issue</span>
            <select value={replacementUnitId} onChange={(event) => setReplacementUnitId(event.target.value)} disabled={replacementUnits === null} className={`${controlClass} mt-2`}>
              <option value="">{replacementUnits === null ? 'Loading available units…' : 'Issue later from Custody & Issuance'}</option>
              {(replacementUnits ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>{[unit.itemDescription, unit.propertyNumber, unit.serialNumber && `S/N ${unit.serialNumber}`].filter(Boolean).join(' · ')}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {replacementUnits && replacementUnits.length === 0
                ? `No available ${replacementLine?.assetType ?? ''} unit — fulfill now and issue one later, or put the request on hold.`
                : 'The old unit is taken back and this one is issued to the requester in the same step.'}
            </span>
          </label>
        )}
        {((isApprovalsPage && confirmAction === 'Reject') ||
          (isFulfillmentPage && confirmAction === 'On Hold')) && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Remarks</span>
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} className={`${textareaClass} mt-2`} />
            {errors.remarks && <span className="mt-1 block text-xs text-red-600">{errors.remarks}</span>}
          </label>
        )}
        {isDisposalPage && confirmAction === 'Record Disposal' && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Disposal date
              <DateField value={disposal.date} onChange={(event) => setDisposal({ ...disposal, date: event.target.value })} className="mt-2 w-full" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Disposal method
              <input value={disposal.method} onChange={(event) => setDisposal({ ...disposal, method: event.target.value })} maxLength={100} className={controlClass} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Document reference
              <input value={disposal.reference} onChange={(event) => setDisposal({ ...disposal, reference: event.target.value })} maxLength={200} className={controlClass} />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={disposal.confirmed} onChange={(event) => setDisposal({ ...disposal, confirmed: event.target.checked })} />
              The disposal was authorized and has been completed.
            </label>
            {errors.disposal && <p role="alert" className="text-sm text-red-700">{errors.disposal}</p>}
          </div>
        )}
        {isCustodyPage && confirmAction === 'Issue' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Recipient Employee ID</span>
            <input type="text" value={issueEmployeeId} onChange={(event) => setIssueEmployeeId(event.target.value)} placeholder="e.g. CICC-0042" className={`${controlClass} mt-2`} />
            {errors.employeeId && <span className="mt-1 block text-xs text-red-600">{errors.employeeId}</span>}
          </label>
        )}
        {isCustodyPage && confirmAction === 'Issue' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Expected return date (optional)</span>
            <DateField value={issueExpectedReturnDate} onChange={(event) => setIssueExpectedReturnDate(event.target.value)} className="mt-2 w-full" />
          </label>
        )}
        {isCustodyPage && confirmAction === 'Transfer' && (
          <label className="block text-sm font-semibold text-slate-700">
            <span>Receiving Office / Section</span>
            <input type="text" value={transferToLocation} onChange={(event) => setTransferToLocation(event.target.value)} placeholder="e.g. Cybercrime Operations Division" className={`${controlClass} mt-2`} />
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
              askToPrint('requisition', created.id, created.requestNumber);
              void fetchLiveRows().catch(() => notify('Submitted, but the list failed to refresh — reload the page to see it.'));
            }}
          />
        )}
      </CenteredModal>
      {printPrompt}
    </div>
  );
}
