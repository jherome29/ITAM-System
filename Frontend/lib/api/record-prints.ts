import client, { type ApiResponse } from './client';

// A numbered paper copy of one record (backend: ReportsService.createRecordPrint). CICC asked for a printout
// after every step, as proof beyond the digital record.

export type PrintKind = 'requisition' | 'asset_request' | 'repair';

export interface RecordPrint {
  id: string;
  documentNumber: string | null;
  verificationCode: string | null;
  generatedAt: string;
  /** 1 for the first print of the record; later ones are marked REPRINT on the paper. */
  copy: number;
  printedByName: string;
}

const BASE: Record<PrintKind, string> = {
  requisition: '/v1/requisitions',
  asset_request: '/v1/asset-requests',
  repair: '/v1/repairs',
};

export const printPath = (kind: PrintKind, id: string) => `${BASE[kind]}/${id}/print`;
export const printListPath = (kind: PrintKind, id: string) => `${BASE[kind]}/${id}/prints`;

/** Requisitions and requests already serve a record's stored documents under /documents; repairs under /prints. */
export const printFilePath = (kind: PrintKind, id: string, formId: string) =>
  kind === 'repair' ? `${BASE[kind]}/${id}/prints/${formId}` : `${BASE[kind]}/${id}/documents/${formId}`;

export const printKindWords = (kind: PrintKind): string =>
  kind === 'asset_request' ? 'request' : kind;

export const recordPrintsApi = {
  /** Makes the next numbered copy and returns it. */
  print: (kind: PrintKind, id: string): Promise<{ blob: Blob; documentNumber: string | null }> =>
    client.post(printPath(kind, id), undefined, { responseType: 'blob' }).then((r) => ({
      blob: r.data as Blob,
      documentNumber: (r.headers['x-document-number'] as string | undefined) ?? null,
    })),

  list: (kind: PrintKind, id: string): Promise<RecordPrint[]> =>
    client.get<ApiResponse<RecordPrint[]>>(printListPath(kind, id)).then((r) => r.data.data),

  /** A stored copy again, exactly as it was printed. */
  file: (kind: PrintKind, id: string, formId: string): Promise<Blob> =>
    client.get(printFilePath(kind, id, formId), { responseType: 'blob' }).then((r) => r.data as Blob),
};
