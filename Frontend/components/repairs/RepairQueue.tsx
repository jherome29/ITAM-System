'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Wrench } from 'lucide-react';
import { AdminPageHeader, Field, MetricCard, Panel, PrimaryButton, SearchToolbar, SecondaryButton, StatusChip, TableWrap, inputClass, tdClass, tdNoWrapClass, thClass } from '@/components/admin/AdminUi';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { assetsApi, type Asset } from '@/lib/api/assets';
import { OUTCOME_LABEL, SERVICE_TYPE_LABEL, repairsApi, type Repair, type RepairOutcome, type RepairServiceType } from '@/lib/api/repairs';
import { localToday } from '@/lib/dates';
import { formatDate, formatDateTime } from '@/lib/requisitions/requisition-view';
import { humanize } from '@/lib/text';
import { DateField } from '@/components/ui/DateField';
import { Notice } from '@/components/ui/Notice';
import { EmptyRow } from '@/components/ui/EmptyRow';
import { ClampText } from '@/components/ui/ClampText';
import { Pager } from '@/components/ui/Pager';
import { RecordPrints, usePrintPrompt } from '@/components/shared/RecordPrints';
import { usePaged } from '@/lib/use-paged';

const FILTERS = [
  { value: 'open', label: 'Under repair' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'closed', label: 'Completed' },
  { value: 'All', label: 'All repairs' },
];

function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(' · ') : (msg ?? fallback);
}

function statusOf(r: Repair): { label: string; tone: 'amber' | 'red' | 'green' | 'slate' } {
  if (r.outcome) return { label: OUTCOME_LABEL[r.outcome], tone: r.outcome === 'repaired' ? 'green' : 'slate' };
  return r.overdue ? { label: 'Overdue', tone: 'red' } : { label: 'Under repair', tone: 'amber' };
}

/**
 * Loaner while the item is repaired: lend the holder an available unit of the
 * same type (issued with a return date, so the overdue-return watcher covers
 * it), and once the repair closes, collect it back. `canReturn` is the
 * custodian's queue — the System Admin's escalation view only reads.
 */
function LoanerSection({ repair, canReturn, onChanged, onIssued, onError }: Readonly<{
  repair: Repair;
  canReturn: boolean;
  onChanged: (message: string) => Promise<void>;
  /** After a loaner has been handed out, so the screen can offer a paper copy. */
  onIssued: () => void;
  onError: (message: string) => void;
}>) {
  const [units, setUnits] = useState<Asset[] | null>(null);
  const [unitId, setUnitId] = useState('');
  const [returnBy, setReturnBy] = useState(repair.dueDate.slice(0, 10));
  const [busy, setBusy] = useState(false);
  const loaner = repair.loaner;
  const canIssue = !repair.completedAt && repair.canAct && Boolean(repair.holder) && !loaner?.withHolder;

  useEffect(() => {
    if (!canIssue || !repair.asset) return;
    let live = true;
    assetsApi
      .list(1, 100, undefined, 'available', repair.asset.assetType)
      .then((res) => { if (live) setUnits(res.data.data.filter((a) => a.assetClass !== 'IES' && a.id !== repair.asset?.id)); })
      .catch(() => { if (live) setUnits([]); });
    return () => { live = false; };
  }, [canIssue, repair.asset]);

  const issue = async () => {
    if (!unitId || busy) return;
    setBusy(true);
    try {
      await repairsApi.issueLoaner(repair.id, { assetId: unitId, expectedReturnDate: returnBy || undefined });
      await onChanged('Loaner issued — the holder has been notified.');
      onIssued();
    } catch (err) {
      onError(errorMessage(err, 'Could not issue the loaner.'));
    } finally {
      setBusy(false);
    }
  };

  const markReturned = async () => {
    if (!loaner || busy) return;
    setBusy(true);
    try {
      await assetsApi.updateLifecycle(loaner.id, { status: 'returned', notes: `Loaner returned after repair of "${repair.asset?.itemDescription ?? 'item'}"` });
      await onChanged('Loaner marked returned.');
    } catch (err) {
      onError(errorMessage(err, 'Could not mark the loaner returned.'));
    } finally {
      setBusy(false);
    }
  };

  if (!loaner && !canIssue) return null;

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
      <h3 className="text-sm font-bold text-slate-950">Loaner unit</h3>
      {loaner && (
        <div className={`rounded-md px-3 py-2 ${loaner.withHolder && repair.completedAt ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
          <p className="font-semibold text-slate-900">{loaner.itemDescription}{loaner.propertyNumber ? ` · ${loaner.propertyNumber}` : ''}</p>
          <p className="mt-0.5 text-xs">
            {loaner.withHolder
              ? `With ${repair.holder?.name ?? 'the holder'}${loaner.expectedReturnDate ? ` — due back ${formatDate(loaner.expectedReturnDate)}` : ''}.${repair.completedAt ? ' The repair is closed, so collect it now.' : ''}`
              : `Back from loan (now ${loaner.status.replaceAll('_', ' ')}).`}
          </p>
          {loaner.withHolder && repair.completedAt && canReturn && (
            <SecondaryButton disabled={busy} onClick={() => void markReturned()}>{busy ? 'Saving…' : 'Mark loaner returned'}</SecondaryButton>
          )}
        </div>
      )}
      {canIssue && (
        <>
          <p className="text-xs text-slate-500">Lend {repair.holder?.name ?? 'the holder'} an available {repair.asset?.assetType ?? ''} unit while this one is repaired. It is issued to them with a return date; closing the repair asks for it back.</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Unit to lend">
              <select className={inputClass} value={unitId} disabled={units === null} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">{units === null ? 'Loading available units…' : units.length === 0 ? 'No available unit of this type' : 'Choose a unit'}</option>
                {(units ?? []).map((u) => <option key={u.id} value={u.id}>{[u.itemDescription, u.propertyNumber, u.serialNumber && `S/N ${u.serialNumber}`].filter(Boolean).join(' · ')}</option>)}
              </select>
            </Field>
            <Field label="Return by">
              <DateField value={returnBy} min={localToday()} onChange={(e) => setReturnBy(e.target.value)} />
            </Field>
          </div>
          <SecondaryButton disabled={busy || !unitId} onClick={() => void issue()}>{busy ? 'Issuing…' : 'Issue loaner'}</SecondaryButton>
        </>
      )}
    </section>
  );
}

interface Draft {
  serviceType: RepairServiceType;
  serviceProvider: string;
  expectedCompletionDate: string;
  findings: string;
  actionTaken: string;
}

const draftOf = (r: Repair): Draft => ({
  serviceType: r.serviceType,
  serviceProvider: r.serviceProvider ?? '',
  expectedCompletionDate: r.expectedCompletionDate?.slice(0, 10) ?? '',
  findings: r.findings ?? '',
  actionTaken: r.actionTaken ?? '',
});

/**
 * Maintenance & Repair — one row per stay in `under_repair` (opened
 * automatically when an asset goes in for repair). The custodian records
 * where it is being repaired, when it is due back, the diagnosis and the work
 * done, then closes it: Repaired (back to the holder, or into stock) or Not
 * repairable (flagged for disposal; the holder can request a replacement).
 * The holder is notified either way. Controls follow the server's `canAct`.
 *
 * `assetBasePath` links each row to the asset page; `adminFallback` is the
 * System Administrator's view, where only custodians' own items are actionable.
 */
export function RepairQueue({
  eyebrow,
  openId,
  assetBasePath,
  adminFallback = false,
}: Readonly<{ eyebrow: string; openId?: string; assetBasePath?: string; adminFallback?: boolean }>) {
  const [rows, setRows] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Repair | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [outcome, setOutcome] = useState<RepairOutcome>('repaired');
  const [returnToStock, setReturnToStock] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');
  const { ask: askToPrint, prompt: printPrompt } = usePrintPrompt();

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const load = useCallback(() => repairsApi.list().then((res) => setRows(res.data)), []);

  useEffect(() => {
    load().catch(() => setLoadError('Could not load repairs. Please refresh the page.')).finally(() => setLoading(false));
  }, [load]);

  const open = (r: Repair | null) => {
    setSelected(r);
    setDraft(r ? draftOf(r) : null);
    setOutcome('repaired');
    setReturnToStock(false);
    setActionError('');
  };

  // Notification deep-link (?open=<id>).
  const handledOpenId = useRef<string | null>(null);
  useEffect(() => {
    if (!openId || loading || handledOpenId.current === openId) return;
    handledOpenId.current = openId;
    repairsApi.getOne(openId).then((res) => open(res.data)).catch(() => setLoadError('That repair could not be found, or it is handled by another custodian.'));
  }, [openId, loading]);

  const edit = (patch: Partial<Draft>) => { setActionError(''); setDraft((d) => (d ? { ...d, ...patch } : d)); };

  const saveProgress = async () => {
    if (!selected || !draft || busy) return;
    setBusy(true);
    setActionError('');
    try {
      const res = await repairsApi.update(selected.id, {
        serviceType: draft.serviceType,
        serviceProvider: draft.serviceType === 'external' ? draft.serviceProvider : '',
        expectedCompletionDate: draft.expectedCompletionDate,
        findings: draft.findings,
        actionTaken: draft.actionTaken,
      });
      open(res.data);
      notify('Repair progress saved.');
      await load().catch(() => {});
    } catch (err) {
      setActionError(errorMessage(err, 'Could not save the repair.'));
    } finally {
      setBusy(false);
    }
  };

  const reviewOutcome = () => {
    if (!draft) return;
    if (draft.actionTaken.trim().length < 5) return setActionError('Describe the work done (at least 5 characters).');
    if (outcome === 'unrepairable' && !draft.findings.trim()) return setActionError('Record the findings — they justify the disposal flag.');
    setConfirming(true);
  };

  const complete = async () => {
    if (!selected || !draft) return;
    setConfirming(false);
    setBusy(true);
    try {
      // Keep the service details the custodian typed but did not save.
      await repairsApi.update(selected.id, {
        serviceType: draft.serviceType,
        serviceProvider: draft.serviceType === 'external' ? draft.serviceProvider : '',
        expectedCompletionDate: draft.expectedCompletionDate,
      });
      const res = await repairsApi.complete(selected.id, {
        outcome,
        findings: draft.findings.trim() || undefined,
        actionTaken: draft.actionTaken.trim(),
        returnToStock: outcome === 'repaired' && returnToStock ? true : undefined,
      });
      open(res.data);
      notify(outcome === 'repaired' ? 'Repair completed — the holder has been notified.' : 'Marked not repairable — flagged for disposal.');
      askToPrint('repair', selected.id, `The repair of ${selected.asset?.itemDescription ?? 'this item'}`);
      await load().catch(() => {});
    } catch (err) {
      setActionError(errorMessage(err, 'Could not complete the repair.'));
    } finally {
      setBusy(false);
    }
  };

  const q = search.toLowerCase();
  const visible = rows
    .filter((r) => {
      if (filter === 'open') return !r.completedAt;
      if (filter === 'overdue') return r.overdue;
      if (filter === 'closed') return Boolean(r.completedAt);
      return true;
    })
    .filter((r) => [r.asset?.itemDescription, r.asset?.propertyNumber, r.holder?.name, r.holder?.employeeId, r.serviceProvider].join(' ').toLowerCase().includes(q));
  const paged = usePaged(visible, `${search}|${filter}`);
  const openRows = rows.filter((r) => !r.completedAt);

  if (loading) return <LoadingSkeleton rows={8} />;

  const outcomeTarget = (() => {
    if (outcome === 'unrepairable') return 'The asset is flagged for disposal (condition: unserviceable) and the IIRUP applies. The holder keeps accountability until COA relief and can request a replacement.';
    if (selected?.holder && !returnToStock) return `The asset goes back to ${selected.holder.name} (condition: serviceable), who is notified to collect it.`;
    return 'The asset returns to stock as available (condition: serviceable).';
  })();

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow={eyebrow}
        title={adminFallback ? 'Repairs (escalations)' : 'Maintenance & Repair'}
        detail={adminFallback
          ? "Repairs of a custodian's own item escalate here — they cannot close their own. Everything else is read-only."
          : 'Every asset under repair. Record where it is and when it is due back, the diagnosis and the work done, then close it as repaired or not repairable — the holder is told either way.'}
      />
      {loadError && <Notice tone="red">{loadError}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Under repair" value={String(openRows.length)} detail="Open repair records" tone="amber" icon={Wrench} />
        <MetricCard label="Overdue" value={String(rows.filter((r) => r.overdue).length)} detail="Past their expected completion" tone="red" icon={AlertTriangle} />
        <MetricCard label="Completed" value={String(rows.length - openRows.length)} detail="Repaired or written off" tone="green" icon={CheckCircle2} />
      </div>
      <SearchToolbar value={search} onChange={setSearch} filterValue={filter} filterOptions={FILTERS} onFilterChange={setFilter} />
      <Panel title="Repairs" detail={`${visible.length} shown · ${rows.length} total`}>
        <TableWrap>
          <table className="w-full min-w-[900px]">
            <thead><tr><th className={thClass}>Asset</th><th className={thClass}>Holder</th><th className={thClass}>Service</th><th className={thClass}>Opened</th><th className={thClass}>Due back</th><th className={thClass}>Status</th><th className={thClass} /></tr></thead>
            <tbody>
              {paged.pageItems.map((r) => {
                const status = statusOf(r);
                return <tr key={r.id} className="hover:bg-blue-50/40">
                  <td className={tdClass}><p className="font-bold text-slate-950"><ClampText lines={2}>{r.asset?.itemDescription}</ClampText></p><p className="text-xs text-slate-500">{[r.asset?.propertyNumber, r.asset && `${r.asset.assetType} · ${r.asset.assetClass}`].filter(Boolean).join(' · ')}</p></td>
                  <td className={tdClass}>{r.holder ? <><p>{r.holder.name}</p><p className="text-xs text-slate-500">{r.holder.employeeId}</p></> : <span className="text-slate-500">In stock</span>}</td>
                  <td className={tdClass}>{SERVICE_TYPE_LABEL[r.serviceType]}{r.serviceProvider ? <p className="text-xs text-slate-500">{r.serviceProvider}</p> : null}</td>
                  <td className={tdNoWrapClass}>{formatDate(r.openedAt)}</td>
                  <td className={tdClass}>{r.completedAt ? formatDate(r.completedAt) : formatDate(r.dueDate)}</td>
                  <td className={tdClass}><StatusChip status={status.label} tone={status.tone} /></td>
                  <td className={`${tdClass} text-right`}><SecondaryButton onClick={() => open(r)}>{!r.completedAt && r.canAct ? 'Update' : 'View'}</SecondaryButton></td>
                </tr>;
              })}
              {visible.length === 0 && <EmptyRow colSpan={7}>No repairs match the current filter.</EmptyRow>}
            </tbody>
          </table>
        </TableWrap>
        <Pager page={paged.page} total={paged.total} pageSize={paged.size} onPage={paged.setPage} noun="repairs" />
      </Panel>

      <DetailDrawer open={Boolean(selected)} title={selected?.asset?.itemDescription ?? 'Repair'} onClose={() => open(null)}>
        {selected && draft && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {([
                ['Property #', selected.asset?.propertyNumber ?? '—'],
                ['Holder', selected.holder ? `${selected.holder.name} · ${selected.holder.employeeId}` : 'In stock'],
                ['Opened', formatDateTime(selected.openedAt)],
                [selected.completedAt ? 'Closed' : 'Due back', selected.completedAt ? formatDateTime(selected.completedAt) : formatDate(selected.dueDate)],
                ['Condition', humanize(selected.asset?.condition) || '—'],
                ['Status', statusOf(selected).label],
              ] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}
            </dl>
            {selected.overdue && <Notice tone="red" icon={<Clock className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />}>Past its expected completion — update the date or record the outcome.</Notice>}
            <div><p className="text-xs font-bold text-slate-500">Reported problem</p><p className="mt-1 whitespace-pre-line text-sm text-slate-700">{selected.reportedProblem ?? 'No description was recorded when it went in.'}</p></div>
            {selected.asset?.components && <p className="text-xs text-slate-500">Components: {selected.asset.components}</p>}
            {assetBasePath && selected.asset && <Link href={`${assetBasePath}/${selected.asset.id}`} className="inline-flex text-sm font-bold text-blue-700 hover:underline">Open asset record →</Link>}

            {selected.completedAt || !selected.canAct ? (
              <section className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
                {!selected.completedAt && <p className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{adminFallback ? `Handled by the ${selected.custodianLabel ?? 'custodian'}.` : 'This is your own item, so another custodian or the System Administrator records its repair.'}</p>}
                {([
                  ['Service', `${SERVICE_TYPE_LABEL[selected.serviceType]}${selected.serviceProvider ? ` — ${selected.serviceProvider}` : ''}`],
                  ['Findings', selected.findings ?? '—'],
                  ['Work done', selected.actionTaken ?? '—'],
                  ...(selected.completedAt ? [['Outcome', `${selected.outcome ? OUTCOME_LABEL[selected.outcome] : '—'}${selected.completedBy ? ` · by ${selected.completedBy.name}` : ''}`]] : []),
                ] as Array<[string, string]>).map(([label, value]) => <div key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-0.5 whitespace-pre-line text-slate-800">{value}</p></div>)}
              </section>
            ) : (
              <>
                <section className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-950">Repair progress</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Repaired by">
                      <select className={inputClass} value={draft.serviceType} onChange={(e) => edit({ serviceType: e.target.value as RepairServiceType })}>
                        <option value="in_house">In-house ({selected.custodianLabel ?? 'custodian'})</option>
                        <option value="external">External service center</option>
                      </select>
                    </Field>
                    <Field label="Expected back">
                      <DateField value={draft.expectedCompletionDate} min={localToday()} onChange={(e) => edit({ expectedCompletionDate: e.target.value })} />
                    </Field>
                  </div>
                  {draft.serviceType === 'external' && (
                    <Field label="Service center / technician"><input className={inputClass} value={draft.serviceProvider} maxLength={150} placeholder="e.g. Dell Authorized Service Center, Makati" onChange={(e) => edit({ serviceProvider: e.target.value })} /></Field>
                  )}
                  <Field label="Findings (diagnosis)"><textarea className={`${inputClass} h-20 py-2`} value={draft.findings} maxLength={2000} placeholder="What is actually wrong — e.g. faulty DC jack, swollen battery." onChange={(e) => edit({ findings: e.target.value })} /></Field>
                  <Field label="Work done"><textarea className={`${inputClass} h-20 py-2`} value={draft.actionTaken} maxLength={2000} placeholder="Parts replaced, settings changed, tests run." onChange={(e) => edit({ actionTaken: e.target.value })} /></Field>
                  <p className="text-xs text-slate-500">Without an expected date it is due {formatDate(selected.defaultDueDate)} (default turnaround); the custodian is alerted once it is overdue.</p>
                  <SecondaryButton disabled={busy} onClick={() => void saveProgress()}>Save progress</SecondaryButton>
                </section>

                <section className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-950">Record outcome</h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {(['repaired', 'unrepairable'] as const).map((o) => <label key={o} className="flex items-center gap-2"><input type="radio" name="repair-outcome" checked={outcome === o} onChange={() => { setActionError(''); setOutcome(o); }} />{OUTCOME_LABEL[o]}</label>)}
                  </div>
                  {outcome === 'repaired' && selected.holder && (
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={returnToStock} onChange={(e) => setReturnToStock(e.target.checked)} />Put it into stock instead of returning it to {selected.holder.name}</label>
                  )}
                  <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">{outcomeTarget}</p>
                  <PrimaryButton disabled={busy} onClick={reviewOutcome}>{outcome === 'repaired' ? 'Complete repair' : 'Mark not repairable'}</PrimaryButton>
                </section>
              </>
            )}
            <LoanerSection
              key={selected.id}
              repair={selected}
              canReturn={!adminFallback}
              onChanged={async (message) => {
                setActionError('');
                const res = await repairsApi.getOne(selected.id);
                setSelected(res.data);
                notify(message);
                await load().catch(() => {});
              }}
              onIssued={() => askToPrint('repair', selected.id, `The loaner for ${selected.asset?.itemDescription ?? 'this repair'}`)}
              onError={setActionError}
            />
            <RecordPrints key={selected.id} kind="repair" recordId={selected.id} />
            {actionError && <Notice tone="red">{actionError}</Notice>}
          </div>
        )}
      </DetailDrawer>
      {printPrompt}
      <ConfirmDialog
        open={confirming}
        title={outcome === 'repaired' ? 'Complete this repair?' : 'Mark as not repairable?'}
        detail={outcomeTarget}
        confirmLabel={outcome === 'repaired' ? 'Complete repair' : 'Mark not repairable'}
        onConfirm={() => void complete()}
        onCancel={() => setConfirming(false)}
      >
        <p className="text-sm text-slate-600">The findings and work done are saved to the repair record and the holder is notified. This closes the repair.</p>
      </ConfirmDialog>
      <Toast message={toast} />
    </div>
  );
}
