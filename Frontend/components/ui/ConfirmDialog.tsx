'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

export function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}: Readonly<{
  open: boolean;
  title: string;
  detail: string;
  confirmLabel?: string;
  /** Name for the button that backs out, e.g. "Keep request" beside a "Cancel request" confirm. */
  cancelLabel?: string;
  /** Blocks the confirm button, e.g. while the dialog's own input says the action cannot succeed. */
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const titleId = useId();
  const detailId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Callers pass a fresh onCancel every render; see DetailDrawer.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', cancelOnEscape);
    // Focus lands on the safe choice - unless something inside the dialog (an
    // autofocused field) already took it - and goes back afterwards.
    if (!dialogRef.current?.contains(document.activeElement)) cancelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', cancelOnEscape);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={detailId} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h2 id={titleId} className="text-lg font-bold text-slate-950">{title}</h2>
        <p id={detailId} className="mt-2 text-sm text-slate-600">{detail}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={confirmDisabled} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

