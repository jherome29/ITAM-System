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
  itPersonnelId: string | null;
  fulfilledAt: string | null;
  fulfillmentNotes: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequisitionItem {
  id: string;
  assetType: string;
  assetClass: string;
  itemDescription: string;
  quantity: number;
  justification: string;
  fulfilledAssetId: string | null;
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
}

export const requisitionsApi = {
  list: (page = 1, limit = 15, status?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (status) params.status = status;
    return client.get<ApiResponse<PaginatedResponse<Requisition>>>('/v1/requisitions', { params }).then((r) => r.data);
  },

  mine: (page = 1, limit = 15) =>
    client.get<ApiResponse<PaginatedResponse<Requisition>>>('/v1/requisitions/mine', { params: { page, limit } }).then((r) => r.data),

  stats: () =>
    client.get<ApiResponse<RequisitionStats>>('/v1/requisitions/stats').then((r) => r.data),

  getOne: (id: string) =>
    client.get<ApiResponse<Requisition>>(`/v1/requisitions/${id}`).then((r) => r.data),

  create: (dto: CreateRequisitionDto) =>
    client.post<ApiResponse<Requisition>>('/v1/requisitions', dto).then((r) => r.data),

  approve: (id: string, comment?: string) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/approve`, { comment }).then((r) => r.data),

  reject: (id: string, comment: string) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/reject`, { comment }).then((r) => r.data),

  hold: (id: string, reason: string) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/hold`, { reason }).then((r) => r.data),

  fulfill: (id: string) =>
    client.post<ApiResponse<Requisition>>(`/v1/requisitions/${id}/fulfill`).then((r) => r.data),
};
