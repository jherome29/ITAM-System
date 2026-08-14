'use client';

import type { ReactNode } from 'react';

export function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel = 'Confirm',
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel?: string;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{detail}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

