import client, { type ApiResponse, type PaginatedResponse } from './client';

export interface Requisition {
  id: string;
  requestNumber: string;
  requestedById: string;
  requisitionType: string;
  status: string;
  items: RequisitionItem[];
  justification: string;
  requiredDate: string;
  slaDeadline: string;
  supervisorId: string | null;
  supervisorDecision: string | null;
  supervisorComments: string | null;
  supervisorDecidedAt: string | null;
  alternateRoutedAt?: string | null;
  itPersonnelId: string | null;
  fulfilledAt: string | null;
  fulfillmentNotes: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  /** Minimal summaries from the API — name/employee ID/section only. */
  requester?: { id: string; name: string; employeeId: string; officeOrSection: string } | null;
  approver?: { id: string; name: string; employeeId: string } | null;
  /** Replacement requisitions only — the unit being replaced. */
  replacedAsset?: ReplacedAsset | null;
  /** COA documents generated for it (detail endpoint only). */
  documents?: RequisitionDocument[];
}

export interface RequisitionDocument {
  id: string;
  formType: string;
  generatedAt: string;
}

/** fulfilledItems links a line to the unit handed out — for a replacement, that unit is issued to the requester. */
export interface FulfillRequisitionDto {
  notes?: string;
  fulfilledItems?: Array<{ requisitionItemId: string; assetId: string }>;
}

export interface ReplacedAsset {
  id: string;
  itemDescription: string;
  propertyNumber: string | null;
  serialNumber: string | null;
  assetType: string;
  assetClass: string;
  condition: string;
  status: string;
  acquisitionDate: string | null;
  components: string | null;
}

export type ReplacementBasis = 'condition' | 'useful_life' | 'repeat_repair' | 'loss_or_damage';

export const REPLACEMENT_BASIS_LABEL: Record<ReplacementBasis, string> = {
  condition: 'No longer serviceable',
  useful_life: 'Past useful life',
  repeat_repair: 'Repeated repairs',
  loss_or_damage: 'Lost, stolen or written off',
};

/** Replacement Validation page — GET /v1/requisitions/replacement-review. */
export interface ReplacementReview {
  requests: Array<Requisition & {
    /** Criterion the request was justified on at submission (from the audit trail). */
    replacementBasis: ReplacementBasis | null;
    /** Completed repairs of the replaced unit in the last 12 months. */
    repairsInWindow: number;
  }>;
  /** Held assets that already qualify but have no open replacement request. */
  candidates: Array<{
    id: string;
    itemDescription: string;
    propertyNumber: string | null;
    assetType: string;
    assetClass: string;
    status: string;
    condition: string;
    acquisitionDate: string | null;
    holder: { name: string; employeeId: string } | null;
    repairsInWindow: number;
    eligibility: { eligible: boolean; basis: ReplacementBasis | null; reason: string };
  }>;
}

export interface RequisitionItem {
  id: string;
  assetType: string;
  assetClass: string;
  itemDescription: string;
  quantity: number;
  justification: string;
  fulfilledAssetId: string | null;
  /** Server-computed at submission: matched an available inventory item. */
  inInventory?: boolean;
}

export interface RequisitionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  fulfilled: number;
  onHold: number;
}

export interface CreateRequisitionDto {
  requisitionType: string;
  justification: string;
  requiredDate: string;
  items: Array<{ itemDescription: string; quantity: number; assetType: string; assetClass: string; justification?: string }>;
  /** Required by the backend only when requisitionType === 'replacement'. */
  replacedAssetId?: string;
}

export const requisitionsApi = {
  list: (page = 1, limit = 15, status?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (status) params.status = status;
    return client.get<ApiResponse<PaginatedResponse<Requisition>>>('/v1/requisitions', { params }).then((r) => r.data);
  },

  mine: (page = 1, limit = 15) =>
    client.get<ApiResponse<PaginatedResponse<Requisition>>>('/v1/requisitions/mine', { params: { page, limit } }).then((r) => r.data),

  /** Requisitions this approver has decided, newest decision first (the pending queue is `list`). */
  decided: (page = 1, limit = 200) =>
    client
      .get<ApiResponse<PaginatedResponse<Requisition>>>('/v1/requisitions/decided', { params: { page, limit } })
      .then((r) => r.data),

  stats: () =>
    client.get<ApiResponse<RequisitionStats>>('/v1/requisitions/stats').then((r) => r.data),

  replacementReview: () =>
    client.get<ApiResponse<ReplacementReview>>('/v1/requisitions/replacement-review').then((r) => r.data),

  getOne: (id: string) =>
    client.get<ApiResponse<Requisition>>(`/v1/requisitions/${id}`).then((r) => r.data),

  create: (dto: CreateRequisitionDto) =>
    client.post<ApiResponse<Requisition>>('/v1/requisitions', dto).then((r) => r.data),

  // Field name must be `comments` (plural) — matches ApproveRequisitionDto /
  // RejectRequisitionDto on the backend. main.ts has forbidNonWhitelisted:
  // true, so a mismatched key here causes every reject (and every approve
  // with a comment) to fail with 400.
  approve: (id: string, comments?: string) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/approve`, { comments }).then((r) => r.data),

  reject: (id: string, comments: string) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/reject`, { comments }).then((r) => r.data),

  hold: (id: string, reason: string) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/hold`, { reason }).then((r) => r.data),

  fulfill: (id: string, dto: FulfillRequisitionDto = {}) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/fulfill`, dto).then((r) => r.data),

  /** A COA document generated for this requisition (e.g. the replacement's return receipt). */
  document: (id: string, formId: string): Promise<Blob> =>
    client
      .get(`/v1/requisitions/${id}/documents/${formId}`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
};
