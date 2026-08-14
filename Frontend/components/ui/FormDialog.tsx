'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function FormDialog({
  open,
  title,
  children,
  submitLabel = 'Save',
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  submitLabel?: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close form">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={onSubmit} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            {submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

