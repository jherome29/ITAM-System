'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { CenteredModal } from '@/components/ui/CenteredModal';
import { Notice } from '@/components/ui/Notice';
import { buttonClass } from '@/components/ui/buttons';
import { apiErrorMessage } from '@/lib/api/error-message';
import { printKindWords, recordPrintsApi, type PrintKind, type RecordPrint } from '@/lib/api/record-prints';
import { formatDateTime } from '@/lib/dates';
import { openStoredPrint, printRecord } from '@/lib/print-record';

// CICC asked for a paper copy after every step, as proof beyond the digital record. This is the Print copy
// button on a requisition, a return / incident request and a repair: it makes the next numbered copy (with
// signature lines and a verification code) and lists the copies made so far.

const MAX_LISTED = 5;

export function RecordPrints({ kind, recordId }: Readonly<{ kind: PrintKind; recordId: string }>) {
  const [prints, setPrints] = useState<RecordPrint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    () => recordPrintsApi.list(kind, recordId).then(setPrints).catch(() => undefined),
    [kind, recordId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const print = () => {
    setBusy(true);
    setError('');
    printRecord(kind, recordId)
      .then(load)
      .catch(async (err: unknown) => setError(await apiErrorMessage(err, 'Could not make the printout. Please try again.')))
      .finally(() => setBusy(false));
  };

  const again = (p: RecordPrint) => {
    setError('');
    openStoredPrint(kind, recordId, p.id, p.documentNumber).catch(async (err: unknown) =>
      setError(await apiErrorMessage(err, 'Could not open that printout. Please try again.')),
    );
  };

  const recent = [...prints].reverse().slice(0, MAX_LISTED);

  return (
    <section aria-label="Paper copy" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-950">Paper copy</h3>
          <p className="text-sm text-slate-600">
            A numbered printout of this {printKindWords(kind)} with signature lines, for your records.
          </p>
        </div>
        <button type="button" onClick={print} disabled={busy} className={buttonClass({ variant: 'secondary' })}>
          <Printer className="h-5 w-5" aria-hidden="true" />
          {busy ? 'Preparing…' : 'Print copy'}
        </button>
      </div>
      {error && <Notice tone="red">{error}</Notice>}
      {recent.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Printed {prints.length} time{prints.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 divide-y divide-slate-200 text-sm text-slate-700">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>
                  <span className="font-semibold">{p.documentNumber ?? 'Printout'}</span> · {formatDateTime(p.generatedAt)} · {p.printedByName}
                </span>
                <button type="button" onClick={() => again(p)} className="font-semibold text-blue-700 hover:underline">
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface PrintTarget {
  kind: PrintKind;
  id: string;
  label: string;
}

/** The "Keep a paper copy?" dialog shown right after an action. Closed while there is no target. */
export function PrintPromptDialog({ target, onClose }: Readonly<{ target: PrintTarget | null; onClose: () => void }>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const print = () => {
    if (!target) return;
    setBusy(true);
    setError('');
    printRecord(target.kind, target.id)
      .then(onClose)
      .catch(async (err: unknown) => setError(await apiErrorMessage(err, 'Could not make the printout. Please try again.')))
      .finally(() => setBusy(false));
  };

  return (
    <CenteredModal
      open={Boolean(target)}
      size="sm"
      title="Keep a paper copy?"
      description={target ? `${target.label} was saved. Print a copy, with signature lines, for your records.` : undefined}
      onClose={onClose}
    >
      {error && <Notice tone="red">{error}</Notice>}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClose} className={buttonClass({ variant: 'secondary' })}>
          Not now
        </button>
        <button type="button" onClick={print} disabled={busy} className={buttonClass()}>
          <Printer className="h-5 w-5" aria-hidden="true" />
          {busy ? 'Preparing…' : 'Print copy'}
        </button>
      </div>
    </CenteredModal>
  );
}

/** `ask(kind, id, "REQ-2026-0054")` after an action succeeds; render `prompt` once in the screen. */
export function usePrintPrompt(): { ask: (kind: PrintKind, id: string, label: string) => void; prompt: ReactNode } {
  const [target, setTarget] = useState<PrintTarget | null>(null);
  const ask = useCallback((kind: PrintKind, id: string, label: string) => setTarget({ kind, id, label }), []);
  return { ask, prompt: <PrintPromptDialog target={target} onClose={() => setTarget(null)} /> };
}
