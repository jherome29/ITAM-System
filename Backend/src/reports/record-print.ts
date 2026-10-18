// What a record printout shows. The service that owns a record (requisitions, return / incident
// requests, repairs) checks who may see it and turns it into this plain shape; the generator only
// draws it. Keeping the two apart means ReportsService never imports those services (they already
// import it), and each record's wording can be tested without a PDF.

export type RecordKind = 'requisition' | 'asset_request' | 'repair';

export interface PrintableRecord {
  kind: RecordKind;
  recordId: string;
  /** e.g. "REQUISITION RECORD". */
  title: string;
  /** The record's own number, e.g. REQ-2026-0054. */
  reference: string;
  /** The current state in words, e.g. "Approved, waiting for the custodian". */
  status: string;
  /** Short label: value facts, drawn in two columns under the title. */
  facts: { label: string; value: string }[];
  /** Items or other tabular detail. */
  table?: {
    title: string;
    columns: { header: string; width: number }[];
    rows: string[][];
  };
  /** Longer text (a reason, findings), drawn as labelled paragraphs. */
  notes: { label: string; value: string }[];
  /** What has happened so far; the generator sorts them oldest first. */
  events: { at: Date; what: string; by: string }[];
  nextStep?: string;
  /** Who signs the paper copy by hand. */
  signatories: { label: string; name: string; role: string }[];
}

export interface PrintMeta {
  /** PR-YYYY-NNNN, from the shared document counters. */
  printNumber: string;
  printedAt: Date;
  printedBy: { name: string; role: string };
  /** 1 for the first print of a record; later prints are marked REPRINT. */
  copy: number;
  firstPrintedAt?: Date;
  /** Printed on the paper so a copy can be checked against the stored one. */
  verificationCode: string;
}

/** MM/DD/YYYY h:mm AM/PM in Manila time, whatever the server's own zone. */
export function formatPrintDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

export function formatPrintDate(date: Date): string {
  return formatPrintDateTime(date).split(' ')[0];
}
