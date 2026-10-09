import client, { type ApiResponse } from './client';

export type AssetRequestType = 'return' | 'repair' | 'damage' | 'loss' | 'theft';
export type AssetRequestStatus = 'submitted' | 'approved' | 'completed' | 'rejected' | 'cancelled';

export interface AssetRequestPerson {
  id: string;
  name: string;
  employeeId: string;
}

export interface AssetRequestAttachment {
  id: string;
  /** 'request' — filed by the holder; 'receipt' — custodian's condition-on-receipt photos. */
  stage: 'request' | 'receipt';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AssetRequest {
  id: string;
  requestNumber: string;
  type: AssetRequestType;
  status: AssetRequestStatus;
  preferredDate: string;
  details: string;
  handoverDate: string | null;
  decisionNotes: string | null;
  decidedAt: string | null;
  completionNotes: string | null;
  completedAt: string | null;
  resultingStatus: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  requester: (AssetRequestPerson & { officeOrSection: string }) | null;
  decidedBy: AssetRequestPerson | null;
  completedBy: AssetRequestPerson | null;
  asset: {
    id: string;
    itemDescription: string;
    propertyNumber: string | null;
    serialNumber: string | null;
    assetType: string;
    assetClass: string;
    status: string;
    /** Accessories recorded on the asset — what to bring at hand-over. */
    components: string | null;
  } | null;
  attachments: AssetRequestAttachment[];
  custodianLabel: string | null;
  /** COA documents generated on completion — the requester's proof. */
  documents: AssetRequestDocument[];
  /** Required documents that failed to generate (custodian can retry). */
  missingDocuments: string[];
  /** True once the holder is no longer accountable for the item. */
  accountabilityCleared: boolean;
}

export interface AssetRequestDocument {
  id: string;
  formType: string;
  label: string;
  generatedAt: string;
}

export interface CreateAssetRequestInput {
  assetId: string;
  type: AssetRequestType;
  preferredDate: string;
  details: string;
  files: File[];
}

export const assetRequestsApi = {
  /** multipart/form-data — the browser sets the boundary header. */
  create: (input: CreateAssetRequestInput) => {
    const body = new FormData();
    body.append('assetId', input.assetId);
    body.append('type', input.type);
    body.append('preferredDate', input.preferredDate);
    body.append('details', input.details);
    input.files.forEach((file) => body.append('attachments', file, file.name));
    return client.post<ApiResponse<AssetRequest>>('/v1/asset-requests', body).then((r) => r.data);
  },

  mine: () => client.get<ApiResponse<AssetRequest[]>>('/v1/asset-requests/mine').then((r) => r.data),

  /** Custodian queue — `status` may be 'open' or a single status. */
  queue: (status?: string) =>
    client.get<ApiResponse<AssetRequest[]>>('/v1/asset-requests', { params: status ? { status } : {} }).then((r) => r.data),

  getOne: (id: string) => client.get<ApiResponse<AssetRequest>>(`/v1/asset-requests/${id}`).then((r) => r.data),

  attachment: (id: string, attachmentId: string): Promise<Blob> =>
    client
      .get(`/v1/asset-requests/${id}/attachments/${attachmentId}`, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  approve: (id: string, dto: { handoverDate?: string; notes?: string }) =>
    client.patch<ApiResponse<AssetRequest>>(`/v1/asset-requests/${id}/approve`, dto).then((r) => r.data),

  reject: (id: string, reason: string) =>
    client.patch<ApiResponse<AssetRequest>>(`/v1/asset-requests/${id}/reject`, { reason }).then((r) => r.data),

  /** Sent as multipart so condition-on-receipt photos can ride along. */
  complete: (id: string, dto: { outcome?: 'repair' | 'disposal'; notes?: string; files?: File[] }) => {
    const body = new FormData();
    if (dto.outcome) body.append('outcome', dto.outcome);
    if (dto.notes) body.append('notes', dto.notes);
    (dto.files ?? []).forEach((file) => body.append('attachments', file, file.name));
    return client.patch<ApiResponse<AssetRequest>>(`/v1/asset-requests/${id}/complete`, body).then((r) => r.data);
  },

  /** A generated COA document for this request (proof of return / incident report). */
  document: (id: string, formId: string): Promise<Blob> =>
    client
      .get(`/v1/asset-requests/${id}/documents/${formId}`, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  /** Custodian retry for documents that failed to generate on completion. */
  regenerateDocuments: (id: string) =>
    client.post<ApiResponse<AssetRequest>>(`/v1/asset-requests/${id}/documents`).then((r) => r.data),

  cancel: (id: string) => client.patch<ApiResponse<AssetRequest>>(`/v1/asset-requests/${id}/cancel`).then((r) => r.data),
};
