'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export function DetailDrawer({ open, title, children, onClose }: Readonly<{ open: boolean; title: string; children: ReactNode; onClose: () => void }>) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Callers pass a fresh onClose on every render. Depending on it would re-run
  // the effect - and pull focus back to the close button - on each keystroke
  // typed into a form inside the drawer.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    // Keyboard and screen-reader users land inside the drawer, and go back to
    // the row they opened it from when it closes.
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-slate-950/40" onClick={onClose} aria-label="Close drawer backdrop" />
      <aside role="dialog" aria-modal="true" aria-labelledby={titleId} className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-slate-950">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close drawer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
