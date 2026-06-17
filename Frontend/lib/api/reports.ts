import client, { type ApiResponse, type PaginatedResponse } from './client';

export interface ReportMeta {
  id: string;
  type: string;
  format: string;
  generatedById: string;
  generatedAt: string;
  url: string | null;
}

export interface FormMeta {
  id: string;
  formType: string;
  generatedById: string;
  relatedAssetId: string | null;
  relatedRequisitionId: string | null;
  filePath: string;
  generatedAt: string;
}

export interface KpiData {
  inventoryAccuracy: number;
  avgApprovalHours: number;
  slaComplianceRate: number;
  totalAssets: number;
  totalRequisitions: number;
  fulfilledThisMonth: number;
  generatedAt: string;
}

export interface GenerateReportDto {
  type: string;
  format: 'pdf' | 'excel';
  filters?: Record<string, string>;
}

export interface GenerateFormDto {
  formType: string;
  assetId?: string;
  requisitionId?: string;
  targetOffice?: string;
  circumstances?: string;
  lossType?: 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
  purpose?: string;
  requestingDivision?: string;
  returneeId?: string;
  receiverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const reportsApi = {
  list: () =>
    client.get<ApiResponse<PaginatedResponse<ReportMeta>>>('/v1/reports').then((r) => r.data),

  forms: (page = 1, limit = 20) =>
    client
      .get<ApiResponse<PaginatedResponse<FormMeta>>>(`/v1/reports/forms?page=${page}&limit=${limit}`)
      .then((r) => r.data),

  /** Download a previously stored form PDF by its record ID. */
  downloadStoredForm: (id: string): Promise<Blob> =>
    client
      .get(`/v1/reports/forms/${id}/download`, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  kpi: () =>
    client.get<ApiResponse<KpiData>>('/v1/reports/kpi').then((r) => r.data),

  generate: (dto: GenerateReportDto) =>
    client.post<ApiResponse<ReportMeta>>('/v1/reports/generate', dto).then((r) => r.data),

  /** Generates a COA official form PDF and returns it as a Blob for direct download. */
  generateFormBlob: (dto: GenerateFormDto): Promise<Blob> =>
    client
      .post('/v1/reports/forms/generate', dto, { responseType: 'blob' })
      .then((r) => r.data as Blob),
};
