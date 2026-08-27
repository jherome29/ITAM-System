/**
 * Trigger a browser download for an in-memory Blob (generated PDF, exported
 * CSV, etc.). Centralised so the object-URL lifecycle (create → click →
 * revoke) lives in one place instead of being re-hand-rolled at every call
 * site.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
