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
  /** Running number of the per-transaction forms, e.g. PAR-2026-0007. */
  documentNumber: string | null;
  generatedById: string;
  relatedAssetId: string | null;
  relatedRequisitionId: string | null;
  filePath: string;
  generatedAt: string;
  /** "Dell Latitude (P-001)" - the asset the form is for. */
  assetLabel: string | null;
  requisitionNumber: string | null;
  generatedByName: string | null;
}

export interface KpiData {
  // Share of assets with a property no. and a serial no. — a data-quality measure,
  // not inventory accuracy (that needs a physical count the system does not record).
  recordCompleteness: number;
  avgApprovalHours: number;
  slaComplianceRate: number;
  totalAssets: number;
  totalRequisitions: number;
  fulfilledThisMonth: number;
  generatedAt: string;
}

export interface GenerateReportDto {
  reportType: string;
  format: 'pdf' | 'excel';
  /** Period (YYYY-MM-DD, inclusive) for the reports that take one: AUDIT_TRAIL. */
  dateFrom?: string;
  dateTo?: string;
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
  /** CICC employee ID of whoever handed the item back (receipts). */
  returneeEmployeeId?: string;
  receiverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const reportsApi = {
  list: () =>
    client.get<ApiResponse<PaginatedResponse<ReportMeta>>>('/v1/reports').then((r) => r.data),

  forms: (page = 1, limit = 20, filter: { formType?: string; search?: string } = {}) =>
    client
      .get<ApiResponse<PaginatedResponse<FormMeta>>>('/v1/reports/forms', {
        params: { page, limit, ...(filter.formType ? { formType: filter.formType } : {}), ...(filter.search ? { search: filter.search } : {}) },
      })
      .then((r) => r.data),

  /** Download a previously stored form PDF by its record ID. */
  downloadStoredForm: (id: string): Promise<Blob> =>
    client
      .get(`/v1/reports/forms/${id}/download`, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  kpi: () =>
    client.get<ApiResponse<KpiData>>('/v1/reports/kpi').then((r) => r.data),

  /** Generate a management report and return it as a downloadable Blob. */
  generate: (dto: GenerateReportDto): Promise<Blob> =>
    client
      .post('/v1/reports/generate', dto, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  /** Generates a COA official form PDF: the file, and the document number it was filed under (null for an unnumbered report). */
  generateFormBlob: (dto: GenerateFormDto): Promise<{ blob: Blob; documentNumber: string | null }> =>
    client.post('/v1/reports/forms/generate', dto, { responseType: 'blob' }).then((r) => ({
      blob: r.data as Blob,
      documentNumber: (r.headers['x-document-number'] as string | undefined) ?? null,
    })),
};
