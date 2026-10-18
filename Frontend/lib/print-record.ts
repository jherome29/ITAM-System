import { downloadBlob } from './download';
import { recordPrintsApi, type PrintKind } from './api/record-prints';

// Opens a record's numbered paper copy in a new tab, ready to print. The tab is opened while the click that
// asked for it is still running (browsers block a tab opened after an await), then pointed at the PDF once it
// arrives. If the browser still refuses the tab, the PDF is downloaded instead, so the click never does nothing.

const REVOKE_AFTER_MS = 5 * 60 * 1000;

function show(blob: Blob, tab: Window | null, documentNumber: string | null): void {
  const pdf = new Blob([blob], { type: 'application/pdf' });
  if (!tab || tab.closed) {
    downloadBlob(pdf, `${documentNumber ?? 'printout'}.pdf`);
    return;
  }
  const url = URL.createObjectURL(pdf);
  tab.location.href = url;
  // The new tab needs the object URL for as long as it is open; free it later, not now.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/** Makes the next numbered copy of the record and opens it. Resolves with its print number. */
export function printRecord(kind: PrintKind, id: string): Promise<string | null> {
  const tab = typeof window === 'undefined' ? null : window.open('', '_blank');
  return recordPrintsApi.print(kind, id).then(
    ({ blob, documentNumber }) => {
      show(blob, tab, documentNumber);
      return documentNumber;
    },
    (error: unknown) => {
      tab?.close();
      throw error;
    },
  );
}

/** Opens a copy that was printed before, exactly as it was. */
export function openStoredPrint(kind: PrintKind, id: string, formId: string, documentNumber: string | null): Promise<void> {
  const tab = typeof window === 'undefined' ? null : window.open('', '_blank');
  return recordPrintsApi.file(kind, id, formId).then(
    (blob) => show(blob, tab, documentNumber),
    (error: unknown) => {
      tab?.close();
      throw error;
    },
  );
}
