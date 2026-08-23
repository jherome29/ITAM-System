'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityTimeline } from '@/components/ui/ActivityTimeline';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { FilterBar } from '@/components/ui/FilterBar';
import { FormDialog } from '@/components/ui/FormDialog';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { InventoryLabelPrinter } from '@/components/inventory/InventoryLabelPrinter';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { ASSET_LIFECYCLE_TRANSITIONS } from '@/lib/assets/lifecycle-transitions';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { assetMockRows } from '@/lib/mock/assets.mock';
import type { MockAsset } from '@/lib/mock/assets.mock';
import { auditMockRows } from '@/lib/mock/audit.mock';
import { disposalMockRows } from '@/lib/mock/disposal.mock';
import { inventoryMockRows } from '@/lib/mock/inventory.mock';
import { maintenanceMockRows } from '@/lib/mock/maintenance.mock';
import { notificationMockRows } from '@/lib/mock/notifications.mock';
import { reportMockRows } from '@/lib/mock/reports.mock';
import { requisitionMockRows } from '@/lib/mock/requisitions.mock';
import type { MockRequisition } from '@/lib/mock/requisitions.mock';
import { mockUsers } from '@/lib/mock/users.mock';
import { ProposedUserRole, proposedRoleLabels } from '@/lib/roles/proposed-roles';
import type { UiPermission } from '@/lib/roles/role-permissions';
import { useAuth } from '@/lib/auth/use-auth';

type Row = Record<string, string | number | boolean | string[] | undefined>;

const employeeId = 'EMP-001';
const approvingOfficerId = 'EMP-003';

const pageCopy: Record<string, { title: string; detail: string; action?: string }> = {
  catalogue: { title: 'Asset Catalogue', detail: 'Search requestable assets and supplies, inspect availability, and submit a mock requisition.', action: 'Request Asset' },
  requisitions: { title: 'My Requisitions', detail: 'Track request status, timelines, forms, and available lifecycle actions.', action: 'Create Requisition' },
  'assigned-assets': { title: 'My Assigned Assets', detail: 'View assigned assets and submit acknowledgement, return, repair, damage, loss, or theft requests.' },
  'returns-incidents': { title: 'Returns & Incidents', detail: 'Create return requests, damage reports, lost/stolen reports, and repair requests.', action: 'File Report' },
  notifications: { title: 'Notifications', detail: 'Review and manage local mock alerts by category.' },
  approvals: { title: 'Approval Queue', detail: 'Review assigned requests, approve, reject, or return them for revision.' },
  'approval-history': { title: 'Approval History', detail: 'View previous approval decisions, remarks, and turnaround time.' },
  assets: { title: 'Asset Registry', detail: 'Role-scoped asset registry with mock create, edit, QR, and lifecycle actions.', action: 'Register Asset' },
  fulfillment: { title: 'Requisition Fulfillment', detail: 'Reserve, hold, and fulfill approved requests with frontend validation.', action: 'Fulfill Request' },
  custody: { title: 'Custody & Issuance', detail: 'Issue, collect, acknowledge, return, transfer, and print mock accountability forms.', action: 'Issue Asset' },
  'qr-scanner': { title: 'QR Scanner', detail: 'Scan or manually enter a mock QR code and run permitted role-specific actions.', action: 'Scan QR' },
  maintenance: { title: 'Maintenance & Repair', detail: 'Record inspection, repair, vendor, cost, completion, replacement, and disposal recommendations.', action: 'Add Maintenance Record' },
  'physical-inventory': { title: 'Physical Inventory', detail: 'Create scan sessions and track found, missing, wrong-location, duplicate, and unregistered items.', action: 'Start Physical Count' },
  disposal: { title: 'Disposal Recommendations', detail: 'Recommend or review disposal with assessments and deferred-backend warnings.', action: 'Recommend Disposal' },
  reports: { title: 'Reports & Forms', detail: 'Search, filter, export, and print mock reports and forms.', action: 'Export Report' },
  'fixed-assets': { title: 'Fixed Asset Registry', detail: 'Manage non-ICT fixed property records in mock mode.', action: 'Add Property' },
  supplies: { title: 'Supply Inventory', detail: 'Track stock, reorder levels, issuances, receipts, and stock-card previews.', action: 'Record Stock Movement' },
  corrections: { title: 'Inventory Corrections', detail: 'Review proposed corrections and approve, reject, or return for clarification.', action: 'Approve Correction' },
  reconciliation: { title: 'Reconciliation', detail: 'Compare system count against physical count and resolve discrepancies.', action: 'Generate Reconciliation Report' },
  replacements: { title: 'Replacement Validation', detail: 'Validate replacements against useful life, age, condition, and repair history.', action: 'Validate Replacement' },
  users: { title: 'User Management', detail: 'Create users, edit profiles, activate, deactivate, unlock, and reset mock passwords.', action: 'Create User' },
  roles: { title: 'Role Assignment', detail: 'Preview role assignments without changing backend RBAC.', action: 'Assign Role' },
  'organizational-units': { title: 'Organizational Units', detail: 'Manage offices, divisions, sections, regions, and reporting relationships.', action: 'Add Unit' },
  'approval-configuration': { title: 'Approval Configuration', detail: 'Configure mock approvers, alternates, SLA hours, and escalation settings.', action: 'Add Rule' },
  'custodian-assignments': { title: 'Custodian Assignments', detail: 'Assign custodians by office, location, and asset family.', action: 'Assign Custodian' },
  'reference-data': { title: 'Reference Data', detail: 'Maintain frontend-only categories, statuses, and form references.', action: 'Add Reference' },
  configuration: { title: 'System Configuration', detail: 'Adjust prototype settings and reset demo state.', action: 'Reset Demo Data' },
  'technical-logs': { title: 'Technical Logs', detail: 'Read mock service health and technical events.' },
  security: { title: 'Security Settings', detail: 'Preview lockout, session, and security policy settings.', action: 'Save Policy' },
  'asset-reports': { title: 'Asset Reports', detail: 'Read-only asset reporting with filters and mock exports.', action: 'Export Report' },
  'requisition-reports': { title: 'Requisition Reports', detail: 'Read-only requisition reporting with turnaround metrics.', action: 'Export Report' },
  'maintenance-disposal': { title: 'Maintenance & Disposal Reports', detail: 'Read-only maintenance and disposal reporting.', action: 'Export Report' },
  'physical-count': { title: 'Physical Count Reports', detail: 'Read-only physical count reports and exception lists.', action: 'Export Report' },
  audit: { title: 'Audit Log', detail: 'Read-only audit event viewer.' },
  forms: { title: 'Forms Archive', detail: 'Read-only generated-form archive with mock print/export actions.', action: 'Export Archive' },
};

function normalizeSlug(slug: string) {
  const aliases: Record<string, string> = {
    queue: 'approvals',
    history: 'approval-history',
    'custody-issuance': 'custody',
    inventory: 'physical-inventory',
    'reports-forms': 'reports',
    'registry-overview': 'assets',
    'replacement-validation': 'replacements',
    'disposal-review': 'disposal',
    'audit-history': 'audit',
    'audit-log': 'audit',
    'forms-archive': 'forms',
    'maintenance-disposal-reports': 'maintenance-disposal',
    'physical-count-reports': 'physical-count',
    'org-units': 'organizational-units',
    'approval-config': 'approval-configuration',
  };
  return aliases[slug] ?? slug;
}

// Slugs whose rows don't depend on `role` — dispatched via lookup instead of
// an if-chain to keep rowsFor's cognitive complexity low (typescript:S3776).
// 'forms' is handled by the report branch in rowsFor, not here.
const SIMPLE_SLUG_HANDLERS: Record<string, () => Row[]> = {
  notifications: () => notificationMockRows.map((item) => ({ ...item, status: item.unread ? 'Unread' : 'Read' })),
  audit: () => auditMockRows.map((item) => ({ ...item, status: item.severity })),
  'technical-logs': () => auditMockRows.map((item) => ({ ...item, status: item.severity })),
  maintenance: () => maintenanceMockRows.map((item) => ({ ...item, status: item.status })),
  'physical-inventory': () => inventoryMockRows.map((item) => ({ ...item, status: item.status })),
  reconciliation: () => inventoryMockRows.map((item) => ({ ...item, status: item.status })),
  disposal: () => disposalMockRows.map((item) => ({ ...item, status: item.status })),
  replacements: () => disposalMockRows.map((item) => ({ ...item, status: item.status })),
  users: () => mockUsers.map((item) => ({ ...item, status: 'Active', role: item.role })),
  roles: () => mockUsers.map((item) => ({ ...item, status: 'Active', role: item.role })),
  catalogue: () => assetMockRows.filter((asset) => asset.status === 'Available' || asset.scope === 'SUPPLY').map(assetToRow),
  'assigned-assets': () => assetMockRows.filter((asset) => asset.assignedEmployeeId === employeeId).map(assetToRow),
  'fixed-assets': () => assetMockRows.filter((asset) => asset.scope === 'PROPERTY').map(assetToRow),
  supplies: () => assetMockRows.filter((asset) => asset.scope === 'SUPPLY').map(assetToRow),
  approvals: () =>
    requisitionMockRows
      .filter((request) => request.status === 'Pending Approval' && request.requesterId !== approvingOfficerId)
      .map(requisitionToRow),
  'approval-history': () =>
    requisitionMockRows
      .filter((request) => ['Approved', 'Rejected', 'Returned for Revision'].includes(request.status))
      .map(requisitionToRow),
};

function assetsForRole(role: ProposedUserRole): Row[] {
  if (role === ProposedUserRole.IT_ASSET_CUSTODIAN) return assetMockRows.filter((asset) => asset.scope === 'ICT').map(assetToRow);
  if (role === ProposedUserRole.PROPERTY_OFFICER) return assetMockRows.map(assetToRow);
  return assetMockRows.filter((asset) => asset.scope !== 'ICT').map(assetToRow);
}

function fulfillmentForRole(role: ProposedUserRole): Row[] {
  return requisitionMockRows
    .filter((request) => ['Approved', 'Pending Fulfillment'].includes(request.status))
    .filter((request) => role !== ProposedUserRole.IT_ASSET_CUSTODIAN || request.scope === 'ICT')
    .filter((request) => role !== ProposedUserRole.PROPERTY_CUSTODIAN || request.scope !== 'ICT')
    .map(requisitionToRow);
}

function requisitionsForRole(role: ProposedUserRole): Row[] {
  const own = role === ProposedUserRole.APPROVING_OFFICER ? 'EMP-003' : employeeId;
  return requisitionMockRows.filter((request) => request.requesterId === own || role === ProposedUserRole.EMPLOYEE).map(requisitionToRow);
}

function rowsFor(role: ProposedUserRole, slug: string): Row[] {
  if (slug.includes('report') || slug === 'forms') return reportMockRows.map((item) => ({ ...item, status: item.status }));

  const handler = SIMPLE_SLUG_HANDLERS[slug];
  if (handler) return handler();

  if (slug === 'assets') return assetsForRole(role);
  if (slug === 'fulfillment') return fulfillmentForRole(role);
  if (slug === 'requisitions') return requisitionsForRole(role);

  return requisitionMockRows.map(requisitionToRow);
}

function assetDivision(asset: MockAsset): string {
  if (asset.assignedTo === 'Ana Reyes') return 'Digital Forensics';
  if (asset.assignedTo === 'Operations Division') return 'Operations';
  if (asset.scope === 'ICT') return 'ICT Unit';
  return 'Property Unit';
}

function assetAccountabilityForm(asset: MockAsset): string {
  if (asset.scope === 'ICT') return 'ICS/PAR-Preview';
  if (asset.scope === 'PROPERTY') return 'PAR-Preview';
  return 'RIS-Preview';
}

function assetToRow(asset: MockAsset): Row {
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    type: asset.type,
    serialNumber: asset.serialNumber,
    location: asset.location,
    assignedTo: asset.assignedTo ?? 'Unassigned',
    division: assetDivision(asset),
    officeOrSection: asset.assignedTo === 'Ana Reyes' ? 'Evidence Processing' : asset.location,
    dateIssued: asset.issuedDate ?? '-',
    accountabilityForm: assetAccountabilityForm(asset),
    expectedReturnDate: asset.returnDate ?? '-',
    condition: asset.condition,
    status: asset.status,
    issuedDate: asset.issuedDate ?? '-',
    returnDate: asset.returnDate ?? '-',
    acknowledgmentStatus: asset.acknowledgmentStatus,
    notes: asset.notes,
  };
}

function requisitionToRow(request: MockRequisition): Row {
  return {
    id: request.id,
    requesterId: request.requesterId,
    requester: request.requester,
    office: request.office,
    item: request.item,
    scope: request.scope,
    requestType: request.requestType,
    quantity: request.quantity,
    priority: request.priority,
    status: request.status,
    submittedDate: request.submittedDate,
    requiredDate: request.requiredDate,
    approvingOfficer: request.approvingOfficer,
    lastUpdate: request.lastUpdate,
    justification: request.justification,
    remarks: request.remarks,
    timeline: request.timeline,
    attachments: request.attachments,
  };
}

function requisitionApiToRow(request: Requisition): Row {
  return {
    id: request.id,
    requesterId: request.requestedById,
    item: request.items.map((i) => i.itemDescription).join(', '),
    requestType: request.requisitionType,
    quantity: request.items.reduce((sum, i) => sum + i.quantity, 0),
    status: request.status,
    submittedDate: request.submittedAt,
    requiredDate: request.requiredDate,
    justification: request.justification,
    remarks: request.supervisorComments ?? '',
  };
}

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

function auditApiToRow(log: AuditLog): Row {
  return {
    id: log.id,
    action: log.action,
    actor: log.userId,
    date: new Date(log.timestamp).toLocaleDateString(),
    severity: log.userRole,
  };
}

function actionPermissionFor(role: ProposedUserRole): UiPermission {
  if (role === ProposedUserRole.MASTER_ADMIN) return 'manage_users';
  if (role === ProposedUserRole.APPROVING_OFFICER) return 'approve_requisition';
  if (role === ProposedUserRole.IT_ASSET_CUSTODIAN) return 'issue_ict_assets';
  if (role === ProposedUserRole.PROPERTY_CUSTODIAN) return 'issue_property';
  if (role === ProposedUserRole.PROPERTY_OFFICER) return 'reconcile_inventory';
  return 'create_requisition';
}

export function WorkflowPage({ role, slug }: Readonly<{ role: ProposedUserRole; slug: string }>) {
  const { user: currentUser } = useAuth();
  const normalizedSlug = normalizeSlug(slug);
  const content = pageCopy[normalizedSlug] ?? { title: 'Workspace', detail: 'Frontend-only operational prototype.', action: 'Run Action' };
  const readOnly = role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER;
  const isInventoryAccountabilityPage = ['assets', 'assigned-assets', 'physical-inventory', 'custody'].includes(normalizedSlug);
  // Single source of truth for which role+slug combinations fetch real data instead of
  // mock rows. Referenced by the rows/loading initializers and the effect guard below —
  // extending this to another role+slug pair only needs a change here, not three
  // synchronized edits.
  const isLiveFetchPage =
    (role === ProposedUserRole.APPROVING_OFFICER && (normalizedSlug === 'approvals' || normalizedSlug === 'requisitions')) ||
    (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER && normalizedSlug === 'audit') ||
    (role === ProposedUserRole.IT_ASSET_CUSTODIAN && (normalizedSlug === 'fulfillment' || normalizedSlug === 'custody' || normalizedSlug === 'maintenance' || normalizedSlug === 'disposal'));
  // The Approving Officer's own approvals queue is the one confirm-action flow in this
  // shared component that must persist for real — see submitApprovalDecision below.
  // Every other role/slug (including this same officer's 'requisitions' tab, which has
  // no real cancel/submit endpoint) keeps using the generic mock runAction path.
  const isApprovingOfficerLiveApprovals =
    isLiveFetchPage && role === ProposedUserRole.APPROVING_OFFICER && normalizedSlug === 'approvals';
  const isItAssetCustodianLiveFulfillment =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'fulfillment';
  const isItAssetCustodianLiveCustody =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'custody';
  const isItAssetCustodianLiveMaintenance =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'maintenance';
  const isItAssetCustodianLiveDisposal =
    isLiveFetchPage && role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'disposal';
  const [rows, setRows] = useState<Row[]>(() => (isLiveFetchPage ? [] : rowsFor(role, normalizedSlug)));
  const [loading, setLoading] = useState(isLiveFetchPage);

  // This component does client-side search/sort/filter over `rows`, which requires the
  // full matching working set in memory — a single server page wouldn't search/sort
  // correctly against data it doesn't have. Fetching a large single page (rather than
  // defaulting to the API's page size of 15) is the pragmatic fix here; true server-side
  // pagination would need this component's search/sort to move server-side too.
  const LIVE_FETCH_LIMIT = 200;
  const [liveFetchTruncated, setLiveFetchTruncated] = useState(false);

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
    if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'maintenance') {
      return assetsApi.list(1, LIVE_FETCH_LIMIT, undefined, 'under_repair').then((res) => {
        setRows(res.data.data.map(assetApiToRow));
        setLiveFetchTruncated(res.data.data.length >= LIVE_FETCH_LIMIT);
      });
    }
    if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && normalizedSlug === 'disposal') {
      return assetsApi.list(1, LIVE_FETCH_LIMIT, undefined, 'available').then((res) => {
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

  const [liveFetchError, setLiveFetchError] = useState('');

  useEffect(() => {
    if (!isLiveFetchPage) return;
    fetchLiveRows()
      .then(() => setLiveFetchError(''))
      .catch(() => setLiveFetchError('Failed to load data. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, [isLiveFetchPage, fetchLiveRows]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('id');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [remarks, setRemarks] = useState('');
  const [issueEmployeeId, setIssueEmployeeId] = useState('');
  const [transferToLocation, setTransferToLocation] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [form, setForm] = useState({ item: '', quantity: '1', requiredDate: '', justification: '', reason: '', attachment: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scanValue, setScanValue] = useState('');
  const statuses = ['All', ...Array.from(new Set(rows.map((row) => String(row.status ?? 'Open'))))];
  const pageSize = 6;

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .filter((row) => statusFilter === 'All' || String(row.status) === statusFilter)
      .filter((row) => Object.values(row).join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')));
  }, [rows, search, statusFilter, sortKey]);

  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const updateSelectedStatus = (status: string) => {
    if (!selected) return;
    setRows((current) => current.map((row) => row.id === selected.id ? { ...row, status, lastUpdate: 'Just now' } : row));
    setSelected((current) => current ? { ...current, status, lastUpdate: 'Just now' } : current);
  };

  const updateRowStatus = (rowId: string, status: string) => {
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, status, unread: false, lastUpdate: 'Just now' } : row));
    setSelected((current) => current?.id === rowId ? { ...current, status, unread: false, lastUpdate: 'Just now' } : current);
  };

  const runAction = (action: string) => {
    if (readOnly && !action.startsWith('Export') && !action.startsWith('Print') && action !== 'View') {
      notify('Read-only viewer: action hidden in production role presentation.');
      return;
    }
    if (action === 'Reject' && !remarks.trim()) {
      setErrors({ remarks: 'Rejection reason is required.' });
      return;
    }
    if (action === 'Return for Revision' && !remarks.trim()) {
      setErrors({ remarks: 'Revision instructions are required.' });
      return;
    }
      const nextStatus: Record<string, string> = {
      Approve: 'Approved',
      Reject: 'Rejected',
      'Return for Revision': 'Returned for Revision',
      Cancel: 'Cancelled',
      Submit: 'Pending Approval',
      Delete: 'Cancelled',
      Reserve: 'Reserved',
      Fulfill: 'Fulfilled',
      Issue: 'Issued',
      Transfer: 'Transferred',
      Return: 'Returned',
      'Mark Complete': 'Completed',
      'Recommend Disposal': 'For Disposal Review',
      'Approve Correction': 'Approved',
      'Mark Read': 'Read',
      'Mark All Read': 'Read',
    };
    if (nextStatus[action]) updateSelectedStatus(nextStatus[action]);
    setConfirmAction(null);
    setRemarks('');
    setErrors({});
    notify(`${action} completed in frontend mock mode.`);
  };

  // Real, persisted counterpart to runAction — used ONLY for the Approving Officer's
  // live approvals queue (see isApprovingOfficerLiveApprovals). Calls the actual
  // requisitions API instead of mutating local mock state.
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      notify(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to complete this action. Please try again.'));
    } finally {
      setActionSubmitting(false);
    }
  };

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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      notify(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to complete this action. Please try again.'));
    } finally {
      setActionSubmitting(false);
    }
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!form.item.trim()) next.item = 'Item is required.';
    if (!form.requiredDate && ['catalogue', 'requisitions', 'returns-incidents'].includes(normalizedSlug)) next.requiredDate = 'Required date is required.';
    if (!form.justification.trim()) next.justification = 'Justification or remarks are required.';
    if (Number(form.quantity) < 1) next.quantity = 'Quantity must be at least 1.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitForm = () => {
    if (!validateForm()) return;
    const id = normalizedSlug === 'returns-incidents' ? `INC-${Date.now().toString().slice(-5)}` : `REQ-${Date.now().toString().slice(-5)}`;
    const newRow: Row = {
      id,
      requester: 'Ana Reyes',
      office: 'Digital Forensics',
      item: form.item,
      requestType: normalizedSlug === 'returns-incidents' ? 'Return' : 'New',
      quantity: Number(form.quantity),
      priority: 'Normal',
      status: normalizedSlug === 'returns-incidents' ? 'Submitted' : 'Pending Approval',
      submittedDate: new Date().toISOString().slice(0, 10),
      requiredDate: form.requiredDate,
      approvingOfficer: 'Mila Santos',
      lastUpdate: 'Just now',
      justification: form.justification,
      timeline: ['Created in frontend mock mode', 'Notification added'],
      attachments: form.attachment ? [form.attachment] : [],
    };
    setRows((current) => [newRow, ...current]);
    setFormOpen(false);
    setForm({ item: '', quantity: '1', requiredDate: '', justification: '', reason: '', attachment: '' });
    setErrors({});
    notify(`${content.action ?? 'Action'} saved. Dashboard counts and notifications updated in mock state.`);
  };

  // Fulfillment/custody/maintenance/disposal have no real "create new" backend action —
  // once live, the header button only ever opened the mock FormDialog and injected a
  // synthetic row into real data. Hide it on these four pages; the other live pages
  // (approvals, audit) never had a header action to begin with.
  const canPrimaryAct = !readOnly && content.action &&
    !(isItAssetCustodianLiveFulfillment || isItAssetCustodianLiveCustody || isItAssetCustodianLiveMaintenance || isItAssetCustodianLiveDisposal);
  const primaryPermission = actionPermissionFor(role);
  // Live-fetched rows carry a real requester UUID, not the mock 'EMP-003' id — compare
  // against the actual logged-in user's id on the live approvals page.
  const selfId = isApprovingOfficerLiveApprovals ? currentUser?.id : approvingOfficerId;
  const selectedIsSelfApproval = role === ProposedUserRole.APPROVING_OFFICER && selected?.requesterId === selfId;

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="space-y-5">
      <Toast message={toast} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">{proposedRoleLabels[role]}</p>
          <h1 className="text-2xl font-bold text-slate-950">{content.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{content.detail}</p>
        </div>
        {canPrimaryAct && (
          <button
            type="button"
            onClick={() => {
              if (normalizedSlug === 'assets' && role === ProposedUserRole.IT_ASSET_CUSTODIAN) {
                window.location.href = '/it-asset-custodian/assets/new';
                return;
              }
              if (content.action?.startsWith('Export') || content.action?.startsWith('Reset')) {
                notify(`${content.action} completed in mock mode.`);
                return;
              }
              setFormOpen(true);
            }}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800"
            data-permission={primaryPermission}
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

      {readOnly && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          Read-only controls are active. Add, edit, approve, issue, transfer, dispose, assign role, and delete actions are hidden.
        </div>
      )}

      {normalizedSlug === 'notifications' && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          {['All', 'Unread', 'Requisitions', 'Assets', 'Returns', 'Incidents'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatusFilter(tab === 'Unread' ? 'Unread' : 'All');
                setSearch(tab === 'All' || tab === 'Unread' ? '' : tab);
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {tab}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setRows((current) => current.map((row) => ({ ...row, status: 'Read', unread: false })));
              notify('All notifications marked as read.');
            }}
            className="ml-auto rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
          >
            Mark all as read
          </button>
        </div>
      )}

      {normalizedSlug === 'roles' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Frontend prototype only. Backend role persistence is not yet implemented.
        </div>
      )}

      {normalizedSlug === 'disposal' && role === ProposedUserRole.PROPERTY_OFFICER && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Disposal review is frontend-only. Backend authorization and disposal persistence are deferred.
        </div>
      )}

      {normalizedSlug === 'qr-scanner' && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-950">Mock QR Scanner</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              placeholder="Enter asset ID, e.g. ICT-00091"
              className="h-10 min-w-72 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => {
                const asset = assetMockRows.find((item) => item.id.toLowerCase() === scanValue.toLowerCase());
                if (!asset) {
                  notify('No mock asset found for that QR code.');
                  return;
                }
                if (role === ProposedUserRole.IT_ASSET_CUSTODIAN && asset.scope !== 'ICT') {
                  notify('Access denied: This asset is managed by the Property Custodian.');
                  return;
                }
                if (role === ProposedUserRole.PROPERTY_CUSTODIAN && asset.scope === 'ICT') {
                  notify('Access denied: This ICT asset is managed by the IT Asset Custodian.');
                  return;
                }
                setSelected(assetToRow(asset));
              }}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
            >
              Resolve QR
            </button>
            <button type="button" onClick={() => setScanValue(role === ProposedUserRole.IT_ASSET_CUSTODIAN ? 'ICT-00091' : 'PPE-00120')} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Use Demo QR
            </button>
          </div>
        </section>
      )}

      {['physical-inventory', 'assets', 'fixed-assets'].includes(normalizedSlug) && (
        <InventoryLabelPrinter
          assets={assetMockRows.filter((asset) => {
            if (role === ProposedUserRole.IT_ASSET_CUSTODIAN) return asset.scope === 'ICT';
            if (role === ProposedUserRole.PROPERTY_CUSTODIAN) return asset.scope !== 'ICT';
            return true;
          })}
        />
      )}

      {isInventoryAccountabilityPage && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Inventory Accountability Tracking</h2>
              <p className="mt-1 text-sm text-slate-600">
                Tracks who the laptop or asset is issued to, when it was issued, their division/office, location, and acknowledgment status.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Frontend mock accountability ledger</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Issued To</th>
                  <th className="px-3 py-2">Division / Office</th>
                  <th className="px-3 py-2">Date Issued</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Form</th>
                  <th className="px-3 py-2">Acknowledgment</th>
                  <th className="px-3 py-2">Expected Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows
                  .filter((row) => String(row.assignedTo ?? 'Unassigned') !== 'Unassigned' || normalizedSlug === 'physical-inventory')
                  .slice(0, 6)
                  .map((row) => (
                    <tr key={`accountability-${String(row.id)}`}>
                      <td className="px-3 py-2">
                        <p className="font-bold text-slate-950">{String(row.name ?? row.item ?? row.id)}</p>
                        <p className="text-xs text-slate-500">{String(row.id)}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{String(row.assignedTo ?? 'Unassigned')}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <p>{String(row.division ?? '-')}</p>
                        <p className="text-xs text-slate-500">{String(row.officeOrSection ?? '-')}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{String(row.dateIssued ?? row.issuedDate ?? '-')}</td>
                      <td className="px-3 py-2 text-slate-700">{String(row.location ?? '-')}</td>
                      <td className="px-3 py-2 text-slate-700">{String(row.accountabilityForm ?? '-')}</td>
                      <td className="px-3 py-2"><StatusBadge status={String(row.acknowledgmentStatus ?? 'Pending')} /></td>
                      <td className="px-3 py-2 text-slate-700">{String(row.expectedReturnDate ?? '-')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <FilterBar
        search={search}
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          { label: 'Status', value: statusFilter, options: statuses, onChange: (value) => { setStatusFilter(value); setPage(1); } },
          { label: 'Sort', value: sortKey, options: ['id', 'status', 'item', 'name', 'category', 'date'], onChange: setSortKey },
        ]}
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Type / Owner</th>
                <th className="px-4 py-3">Date / Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleRows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-950">{String(row.item ?? row.name ?? row.title ?? row.action ?? row.id)}</p>
                    <p className="text-xs text-slate-500">{String(row.id)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{String(row.requestType ?? row.category ?? row.type ?? row.actor ?? row.requester ?? row.office ?? '-')}</td>
                  <td className="px-4 py-3 text-slate-600">{String(row.requiredDate ?? row.submittedDate ?? row.date ?? row.location ?? row.period ?? '-')}</td>
                  <td className="px-4 py-3"><StatusBadge status={String(row.status ?? 'Open')} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setSelected(row)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">View</button>
                      {!readOnly && normalizedSlug !== 'notifications' && (
                        <button type="button" onClick={() => { setSelected(row); setConfirmAction(actionLabel(normalizedSlug, role)); }} className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800">
                          {actionLabel(normalizedSlug, role)}
                        </button>
                      )}
                      {normalizedSlug === 'notifications' && (
                        <button
                          type="button"
                          onClick={() => {
                            updateRowStatus(String(row.id), 'Read');
                            notify('Notification marked as read.');
                          }}
                          className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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

      <DetailDrawer open={Boolean(selected)} title={String(selected?.item ?? selected?.name ?? selected?.title ?? selected?.id ?? 'Record')} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(selected).filter(([, value]) => !Array.isArray(value)).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{key}</dt>
                  <dd className="mt-1 text-sm text-slate-900">{String(value ?? '-')}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-950">Timeline</h3>
              <ActivityTimeline items={Array.isArray(selected.timeline) ? selected.timeline : ['Opened in frontend prototype', 'No backend persistence performed']} />
            </div>
            {selectedIsSelfApproval && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Self-approval is disabled in this frontend prototype.
              </p>
            )}
            {!readOnly && !selectedIsSelfApproval && (
              <div className="flex flex-wrap gap-2">
                {detailActions(normalizedSlug, role, isLiveFetchPage, selected ? String(selected.status ?? '') : undefined).map((action) => (
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

      <FormDialog open={formOpen} title={content.action ?? 'Mock Action'} submitLabel="Submit" onSubmit={submitForm} onClose={() => setFormOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item" value={form.item} error={errors.item} onChange={(value) => setForm((current) => ({ ...current, item: value }))} />
          <Field label="Quantity" value={form.quantity} error={errors.quantity} type="number" onChange={(value) => setForm((current) => ({ ...current, quantity: value }))} />
          <Field label="Required date" value={form.requiredDate} error={errors.requiredDate} type="date" onChange={(value) => setForm((current) => ({ ...current, requiredDate: value }))} />
          <Field label="Mock attachment" value={form.attachment} onChange={(value) => setForm((current) => ({ ...current, attachment: value }))} placeholder="filename.pdf" />
          <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
            <span>Justification / remarks</span>
            <textarea value={form.justification} onChange={(event) => setForm((current) => ({ ...current, justification: event.target.value }))} className="mt-2 h-24 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            {errors.justification && <span className="mt-1 block text-xs text-red-600">{errors.justification}</span>}
          </label>
          <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" />
            <span>I certify that this frontend mock submission is accurate for demonstration purposes.</span>
          </label>
        </div>
      </FormDialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}>) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function actionLabel(slug: string, role: ProposedUserRole) {
  if (slug === 'approvals') return 'Review';
  if (slug === 'fulfillment') return 'Fulfill';
  if (slug === 'custody') return 'Issue';
  if (slug === 'maintenance') return 'Mark Complete';
  if (slug === 'physical-inventory') return 'Verify';
  if (slug === 'disposal') return role === ProposedUserRole.PROPERTY_OFFICER ? 'Approve' : 'Recommend Disposal';
  if (slug === 'corrections') return 'Approve Correction';
  if (slug === 'reports' || slug.includes('report') || slug === 'forms') return 'Export';
  return 'Open';
}

function detailActions(slug: string, role: ProposedUserRole, isLive: boolean, selectedStatus?: string) {
  if (slug === 'approvals') return ['Approve', 'Reject', 'Return for Revision'];
  if (slug === 'requisitions') return ['Cancel', 'Submit'];
  if (slug === 'assigned-assets') return ['Acknowledge', 'Return', 'Report Damage', 'Request Repair'];
  // Live fulfillment only supports the two real backend actions — 'Reserve' has no
  // requisitionsApi equivalent, so it stays mock-only and is dropped once this is real.
  if (slug === 'fulfillment') return isLive ? ['Fulfill', 'On Hold'] : ['Reserve', 'Fulfill', 'On Hold'];
  if (slug === 'custody') {
    // Live custody gates by the asset's actual status via the same transition map the
    // asset detail page's lifecycle dropdown uses — offering 'Issue' on an already-issued
    // asset used to succeed in the UI and fail with a 400 from the backend state machine.
    if (isLive && selectedStatus) {
      const custodyActionForNextStatus: Record<string, string> = { issued: 'Issue', transferred: 'Transfer', returned: 'Return' };
      const allowed = ASSET_LIFECYCLE_TRANSITIONS[selectedStatus] ?? [];
      return allowed.map((next) => custodyActionForNextStatus[next]).filter((action): action is string => Boolean(action));
    }
    return ['Issue', 'Transfer', 'Return'];
  }
  if (slug === 'maintenance') return ['Mark Complete', 'Recommend Disposal'];
  if (slug === 'physical-inventory') return ['Verify', 'Mark Reconciled'];
  if (slug === 'disposal') return role === ProposedUserRole.PROPERTY_OFFICER ? ['Approve', 'Reject', 'Return for Revision'] : ['Recommend Disposal'];
  if (slug === 'users') return ['Unlock', 'Reset Password', 'Deactivate'];
  if (slug === 'roles') return ['Assign Role'];
  return ['Open'];
}
