'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Activity, Archive, Download, FileClock, KeyRound, Save } from 'lucide-react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import { auditRecordText, auditUserText } from '@/lib/audit-label';
import { reportsApi } from '@/lib/api/reports';
import { apiErrorMessage } from '@/lib/api/error-message';
import { downloadBlob } from '@/lib/download';
import {
  systemConfigApi,
  changedSystemConfigPayload,
  systemConfigToForm,
  CONFIG_META_KEYS,
  type SystemConfigFormValues,
  type SystemConfigMeta,
} from '@/lib/api/systemConfig';
import { AdminPageHeader, Field, inputClass, MetricCard, Panel, PrimaryButton, SearchToolbar, SecondaryButton, TableWrap, tdClass, thClass } from './AdminUi';
import { formatDateTime } from '@/lib/dates';

type PlatformSlug = 'configuration' | 'audit';

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminPlatformPages({ slug }: Readonly<{ slug: PlatformSlug }>) {
  if (slug === 'configuration') return <SystemSettingsPage />;
  return <AuditLogPage />;
}

// "Who set the SLA to 4 hours, and when?" — the system_config row has carried
// updated_by / updated_at all along; this just surfaces it per setting.
function ProvenanceLine({
  meta,
  keyName,
}: Readonly<{ meta: Record<string, SystemConfigMeta> | null; keyName: string }>) {
  const entry = meta?.[keyName];
  if (!entry || (!entry.updatedAt && !entry.updatedBy)) {
    return <p className="mt-1 text-xs text-slate-400">Built-in default — never changed here.</p>;
  }
  return (
    <p className="mt-1 text-xs text-slate-400">
      Last changed {entry.updatedAt ? formatDateTime(entry.updatedAt) : 'at an unknown time'}
      {entry.updatedBy ? ` by ${entry.updatedByName ?? 'a removed account'}` : ''}
    </p>
  );
}

function SystemSettingsPage() {
  const [form, setForm] = useState<SystemConfigFormValues | null>(null);
  // As last loaded or saved: Save sends only what differs from it.
  const [initialForm, setInitialForm] = useState<SystemConfigFormValues | null>(null);
  const [meta, setMeta] = useState<Record<string, SystemConfigMeta> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    systemConfigApi
      .get()
      .then((r) => {
        const loaded = systemConfigToForm(r.data);
        setForm(loaded);
        setInitialForm(loaded);
        setMeta(r.data.meta ?? null);
        setError('');
      })
      .catch(() => setError('Failed to load configuration. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    load();
  };

  const set =
    (k: keyof SystemConfigFormValues) => (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const handleSave = async () => {
    if (!form || !initialForm) return;
    setError('');
    setSaved(false);
    const changes = changedSystemConfigPayload(form, initialForm);
    if (Object.keys(changes).length === 0) {
      setError('Nothing has changed.');
      return;
    }
    setSaving(true);
    try {
      const r = await systemConfigApi.update(changes);
      const reloaded = systemConfigToForm(r.data);
      setForm(reloaded);
      setInitialForm(reloaded);
      setMeta(r.data.meta ?? null);
      setSaved(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to save configuration.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="System Settings"
        detail="Runtime AIMRS rules. Changes apply immediately once saved and are recorded in the audit trail."
        action={
          form ? (
            <PrimaryButton icon={Save} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </PrimaryButton>
          ) : undefined
        }
      />

      {!form && error ? (
        <Panel title="System Settings">
          <div className="space-y-3 p-5">
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            <button
              type="button"
              onClick={retry}
              disabled={loading}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </Panel>
      ) : !form ? (
        <Panel title="System Settings">
          <div className="p-5">
            <LoadingSkeleton rows={6} />
          </div>
        </Panel>
      ) : (
        <>
          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {saved && (
            <div className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Settings saved.
            </div>
          )}

          <Panel title="Official forms">
            <div className="space-y-4 p-5">
              <div>
                <Field label="Entity name">
                  <input value={form.entityName} onChange={set('entityName')} maxLength={150} className={inputClass} />
                </Field>
                <p className="mt-1 text-xs text-slate-500">Printed in the header of every official COA form and management report.</p>
                <ProvenanceLine meta={meta} keyName={CONFIG_META_KEYS.entityName} />
              </div>
              <div>
                <Field label="Fund cluster">
                  <input value={form.fundCluster} onChange={set('fundCluster')} maxLength={60} placeholder="e.g. 01 Regular Agency Fund" className={inputClass} />
                </Field>
                <p className="mt-1 text-xs text-slate-500">Printed on the forms that carry one. Leave empty and the form prints a line to fill in by hand.</p>
                <ProvenanceLine meta={meta} keyName={CONFIG_META_KEYS.fundCluster} />
              </div>
            </div>
          </Panel>

          <Panel title="Requisition SLA">
            <div className="p-5">
              <Field label="Requisition Approval SLA (hours)">
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={form.slaApprovalHours}
                  onChange={set('slaApprovalHours')}
                  className={inputClass}
                />
              </Field>
              <p className="mt-1 text-xs text-slate-500">
                Breach alert fires past this; the pending-approval nudge fires at half of it.
              </p>
              <ProvenanceLine meta={meta} keyName={CONFIG_META_KEYS.sla} />
            </div>
          </Panel>

          <Panel title="Inventory Alerts">
            <div className="p-5">
              <Field label="Default Low-Stock Reorder Level (units)">
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={form.defaultReorderLevel}
                  onChange={set('defaultReorderLevel')}
                  className={inputClass}
                />
              </Field>
              <p className="mt-1 text-xs text-slate-500">
                Fallback threshold for IES supply items that have no per-item reorder level set.
              </p>
              <ProvenanceLine meta={meta} keyName={CONFIG_META_KEYS.reorder} />
            </div>
          </Panel>

          <Panel title="Replacement — Useful-Life Threshold (years)">
            <div className="space-y-4 p-5">
              <Field label="PPE">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.usefulLifePPE}
                  onChange={set('usefulLifePPE')}
                  className={inputClass}
                />
              </Field>
              <Field label="SEP">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.usefulLifeSEP}
                  onChange={set('usefulLifeSEP')}
                  className={inputClass}
                />
              </Field>
              <Field label="IES">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.usefulLifeIES}
                  onChange={set('usefulLifeIES')}
                  className={inputClass}
                />
              </Field>
              <p className="text-xs text-slate-500">
                A serviceable asset older than its class threshold may be replaced.
              </p>
              <ProvenanceLine meta={meta} keyName={CONFIG_META_KEYS.usefulLife} />
            </div>
          </Panel>

          <Panel title="Replacement — Repeat Repairs">
            <div className="p-5">
              <Field label="Repairs within 12 months">
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={form.repeatRepairLimit}
                  onChange={set('repeatRepairLimit')}
                  className={inputClass}
                />
              </Field>
              <p className="mt-1 text-xs text-slate-500">
                A serviceable asset repaired this many times in the last 12 months may be replaced.
              </p>
              <ProvenanceLine meta={meta} keyName={CONFIG_META_KEYS.repeatRepair} />
            </div>
          </Panel>

          <Panel title="Security">
            <div className="p-5">
              <Field label="Max Failed Login Attempts">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxLoginAttempts}
                  onChange={set('maxLoginAttempts')}
                  className={inputClass}
                />
              </Field>
              <p className="mt-1 text-xs text-slate-500">
                Account locks after this many consecutive failed sign-ins.
              </p>
              <ProvenanceLine meta={meta} keyName={CONFIG_META_KEYS.maxLogin} />
            </div>
          </Panel>

          <p className="px-1 text-xs text-slate-400">
            Document-number formats, notification routing, data retention, and localization are not
            configurable here yet.
          </p>
        </>
      )}
    </div>
  );
}

const AUDIT_PAGE_SIZE = 200;

// Also the Management / Audit viewer's Audit Log (read-only role, same evidence).
export function AuditLogPage({ eyebrow }: Readonly<{ eyebrow?: string }> = {}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [toast, setToast] = useState('');
  const [reporting, setReporting] = useState(false);

  // The date range is applied server-side (GET /v1/audit?startDate&endDate);
  // the text box below still filters the returned window client-side.
  const load = useCallback(() => {
    auditApi
      .list(1, AUDIT_PAGE_SIZE, undefined, from || undefined, to || undefined)
      .then((res) => setLogs(res.data.data))
      .catch(() => setToast('Failed to load audit log.'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDateChange = (which: 'from' | 'to', value: string) => {
    setLoading(true);
    if (which === 'from') setFrom(value);
    else setTo(value);
  };

  const capped = logs.length === AUDIT_PAGE_SIZE;

  const rows = logs.filter((log) =>
    `${log.userName ?? ''} ${log.userId} ${log.userRole} ${log.action} ${log.affectedRecordType ?? ''} ${log.recordLabel ?? ''} ${log.affectedRecordId ?? ''} ${log.ipAddress}`.toLowerCase().includes(search.toLowerCase()),
  );

  const uniqueUsers = new Set(logs.map((log) => log.userId)).size;
  const uniqueActions = new Set(logs.map((log) => log.action)).size;

  const handleExport = () => {
    downloadCsv('aimrs-audit-log.csv', rows.map((log) => ({
      Timestamp: new Date(log.timestamp).toISOString(),
      User: log.userName ?? '',
      'User ID': log.userId,
      'Role at time': log.userRole,
      Action: log.action,
      'Record type': log.affectedRecordType ?? '',
      Record: log.recordLabel ?? '',
      'Record ID': log.affectedRecordId ?? '',
      'IP address': log.ipAddress,
    })));
    setToast('Filtered audit log downloaded as CSV.');
  };

  // The official Audit Trail Report (CLAUDE.md 7.1): the same period as the
  // filter above, named users, up to 10,000 entries - unlike the CSV, which is
  // only the rows on screen.
  const handleReport = async (format: 'pdf' | 'excel') => {
    setReporting(true);
    try {
      const blob = await reportsApi.generate({ reportType: 'AUDIT_TRAIL', format, dateFrom: from || undefined, dateTo: to || undefined });
      downloadBlob(blob, `audit-trail-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      setToast('Audit Trail Report downloaded.');
    } catch (err) {
      setToast(await apiErrorMessage(err, 'Could not generate the Audit Trail Report.'));
    } finally {
      setReporting(false);
    }
  };

  return <div className="space-y-4"><AdminPageHeader eyebrow={eyebrow} title="Audit Log" detail="Inspect append-only evidence of authentication, authorization, asset, requisition, report, and administrative activity." action={<div className="flex flex-wrap gap-2"><SecondaryButton icon={Download} onClick={handleExport}>Export CSV</SecondaryButton><SecondaryButton icon={Download} onClick={() => void handleReport('pdf')} disabled={reporting}>Report (PDF)</SecondaryButton><SecondaryButton icon={Download} onClick={() => void handleReport('excel')} disabled={reporting}>Report (Excel)</SecondaryButton></div>} />
    <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3"><Archive className="mt-0.5 h-5 w-5 flex-none text-blue-700" /><div><p className="text-sm font-bold text-blue-950">Immutable audit evidence</p><p className="mt-0.5 text-xs text-blue-800">Audit records cannot be edited or deleted. Every logged action succeeded by definition; timestamps are recorded in UTC.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><MetricCard label="Events loaded" value={String(logs.length)} detail={from || to ? 'Within the selected date range' : 'Most recent audit records from the API'} tone="blue" icon={Activity} /><MetricCard label="Unique users" value={String(uniqueUsers)} detail="Distinct accounts represented" tone="blue" icon={KeyRound} /><MetricCard label="Unique actions" value={String(uniqueActions)} detail="Distinct action types represented" tone="blue" icon={FileClock} /></div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="User, role, action, or record">
      <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600">From<input type="date" value={from} max={to || undefined} onChange={(event) => handleDateChange('from', event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
      <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600">To<input type="date" value={to} min={from || undefined} onChange={(event) => handleDateChange('to', event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
      {(from || to) && <SecondaryButton onClick={() => { setLoading(true); setFrom(''); setTo(''); }}>Clear dates</SecondaryButton>}
    </SearchToolbar>
    <Panel title="Audit Events" detail={loading ? 'Loading audit events…' : `${rows.length} audit events shown${capped ? ` — first ${AUDIT_PAGE_SIZE}, narrow the date range for more` : ''}`}>{loading ? <div className="p-6"><LoadingSkeleton rows={8} /></div> : <TableWrap><table className="min-w-[960px] w-full"><thead><tr><th className={thClass}>Timestamp</th><th className={thClass}>User</th><th className={thClass}>Role at time</th><th className={thClass}>Action</th><th className={thClass}>Affected record</th><th className={thClass}>IP address</th><th className={`${thClass} text-right`}>Inspect</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No audit logs found.</td></tr> : rows.map((log) => <tr key={log.id} className="hover:bg-slate-50"><td className={tdClass}>{formatDateTime(log.timestamp)}<span className="block text-xs text-slate-500">{log.id.slice(0, 8)}…</span></td><td className={`${tdClass} font-semibold text-slate-950`} title={log.userId}>{auditUserText(log)}</td><td className={tdClass}>{log.userRole}</td><td className={`${tdClass} font-mono text-xs`}>{log.action}</td><td className={`${tdClass} text-xs`} title={log.affectedRecordId ?? undefined}>{auditRecordText(log)}</td><td className={`${tdClass} font-mono text-xs`}>{log.ipAddress}</td><td className={`${tdClass} text-right`}><button type="button" onClick={() => setSelected(log)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Inspect ${log.id}`}><FileClock className="h-4 w-4" /></button></td></tr>)}</tbody></table></TableWrap>}</Panel>
    <DetailDrawer open={Boolean(selected)} title={selected?.action ?? 'Audit event'} onClose={() => setSelected(null)}>{selected && <div className="space-y-4">{[['ID', selected.id], ['Timestamp', formatDateTime(selected.timestamp)], ['User', selected.userName ?? '—'], ['User ID', selected.userId], ['Role at time', selected.userRole], ['Action', selected.action], ['Affected record', selected.recordLabel ?? '—'], ['Affected record type', selected.affectedRecordType ?? '—'], ['Affected record ID', selected.affectedRecordId ?? '—'], ['IP address', selected.ipAddress], ['Metadata', selected.metadata ? JSON.stringify(selected.metadata) : '—']].map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm"><span className="capitalize text-slate-500">{key}</span><span className="text-right font-mono text-xs font-semibold">{value}</span></div>)}<Panel title="Event integrity"><div className="space-y-2 p-4 text-xs text-slate-600"><p><strong>Write mode:</strong> Append only</p><p><strong>Update:</strong> Not permitted</p><p><strong>Delete:</strong> Not permitted</p><p><strong>Metadata:</strong> Includes UTC timestamp, user ID, role, source IP, record ID, and safe before/after values where applicable.</p></div></Panel></div>}</DetailDrawer><Toast message={toast} /></div>;
}
