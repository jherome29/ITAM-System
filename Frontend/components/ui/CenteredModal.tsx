'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';

export function CenteredModal({
  open,
  title,
  description,
  children,
  onClose,
  size = 'lg',
}: Readonly<{
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  /** `sm` for a short confirmation or a few fields; `lg` (default) for a long form. */
  size?: 'sm' | 'lg';
}>) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close modal backdrop"
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="centered-modal-title"
        className={`relative m-0 flex max-h-[calc(100dvh-1.5rem)] w-full ${size === 'sm' ? 'max-w-md' : 'max-w-3xl'} flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-2xl sm:max-h-[calc(100dvh-3rem)]`}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 id="centered-modal-title" className="line-clamp-2 text-xl font-bold text-slate-950" title={title}>{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </dialog>
    </div>
  );
}
