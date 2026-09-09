'use client';

import { useCallback, useEffect, useId, useState, type ChangeEvent } from 'react';
import { Activity, Archive, Clock3, Download, FileClock, KeyRound, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast } from '@/components/ui/Toast';
import { auditApi, type AuditLog } from '@/lib/api/audit';
import {
  systemConfigApi,
  buildUpdateSystemConfigPayload,
  systemConfigToForm,
  type SystemConfigFormValues,
} from '@/lib/api/systemConfig';
import { AdminPageHeader, Field, inputClass, MetricCard, Panel, PrimaryButton, SearchToolbar, SecondaryButton, StatusChip, TableWrap, tdClass, thClass } from './AdminUi';

type PlatformSlug = 'configuration' | 'security' | 'audit';

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
  if (slug === 'security') return <SecurityPoliciesPage />;
  return <AuditLogPage />;
}

function SystemSettingsPage() {
  const [form, setForm] = useState<SystemConfigFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    systemConfigApi
      .get()
      .then((r) => {
        setForm(systemConfigToForm(r.data));
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
    if (!form) return;
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const r = await systemConfigApi.update(buildUpdateSystemConfigPayload(form));
      setForm(systemConfigToForm(r.data));
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
            </div>
          </Panel>

          <p className="px-1 text-xs text-slate-400">
            Numbering formats, notification routing, forms &amp; print, data retention, and
            localization are planned and not yet configurable here.
          </p>
        </>
      )}
    </div>
  );
}

const securitySections = ['Authentication', 'Sessions', 'Access Policy', 'Network', 'Emergency Access'] as const;

function SecurityPoliciesPage() {
  const [section, setSection] = useState<(typeof securitySections)[number]>('Authentication');
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState('');
  return <div className="space-y-4"><AdminPageHeader title="Security Policies" detail="Configure authentication, session, access, and emergency controls. Sensitive changes require reauthentication and audit capture." action={<PrimaryButton icon={Save} onClick={() => { setDirty(false); setToast('Security policy saved in frontend mock state.'); }}>Save policy</PrimaryButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Security posture" value="82%" detail="Three controls need attention" tone="amber" icon={ShieldCheck} /><MetricCard label="MFA coverage" value="94%" detail="Mandatory for administrators" tone="green" icon={KeyRound} /><MetricCard label="Locked accounts" value="1" detail="No active compromise detected" tone="red" icon={LockKeyhole} /><MetricCard label="Session policy" value="15 min" detail="Idle timeout target" tone="green" icon={Clock3} /></div>
    {dirty && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Security policy changes are unsaved. Production save will require administrator reauthentication.</div>}
    <div className="grid gap-4 xl:grid-cols-[240px_1fr]"><Panel title="Policy Areas" detail="Security by Design controls"><nav className="p-2">{securitySections.map((item) => <button key={item} type="button" onClick={() => setSection(item)} className={`block w-full rounded-md px-3 py-2.5 text-left text-sm ${section === item ? 'bg-blue-50 font-bold text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}>{item}</button>)}</nav></Panel><Panel title={section} detail="Current policy and recommended control state"><form className="space-y-5 p-5" onChange={() => setDirty(true)} onSubmit={(event) => event.preventDefault()}>{section === 'Authentication' && <><PolicyToggle label="Require MFA for privileged accounts" detail="Mandatory for Master Administrator, custodians, approvers, and audit viewers" checked /><PolicyToggle label="Require MFA for all accounts" detail="Phased enrollment can be enabled after privileged rollout" /><div className="grid gap-4 md:grid-cols-2"><Field label="Failed attempts before lockout"><input type="number" defaultValue="5" min="3" max="10" className={inputClass} /></Field><Field label="Automatic unlock"><select className={inputClass}><option>30 minutes</option><option>Administrator only</option></select></Field></div></>}{section === 'Sessions' && <><div className="grid gap-4 md:grid-cols-2"><Field label="Idle timeout"><select className={inputClass}><option>15 minutes</option><option>30 minutes</option></select></Field><Field label="Maximum access-token lifetime"><select className={inputClass}><option>8 hours</option><option>4 hours</option></select></Field></div><PolicyToggle label="Prevent concurrent sessions" detail="A new login invalidates the previous token version" checked /><PolicyToggle label="Terminate sessions after password reset" detail="Forces reauthentication on all devices" checked /></>}{section === 'Access Policy' && <><PolicyToggle label="Deny access by default" detail="Routes without explicit role authorization are rejected" checked /><PolicyToggle label="Require annual role review" detail="Privileged access should be reviewed more frequently" checked /><PolicyToggle label="Detect separation-of-duty conflicts" detail="Warn when approval and fulfillment rights overlap" checked /></>}{section === 'Network' && <><PolicyToggle label="Require HTTPS in production" detail="TLS is managed by CICC IT" checked /><Field label="Trusted administrative network ranges"><textarea className={`${inputClass} h-24 py-2`} defaultValue="10.10.0.0/16" /></Field><p className="text-xs text-slate-500">Network restrictions must be enforced by the backend and CICC infrastructure, not only by this interface.</p></>}{section === 'Emergency Access' && <><PolicyToggle label="Enable emergency administrator account" detail="Disabled by default; activation requires two-person approval" /><Field label="Emergency access review interval"><select className={inputClass}><option>Every use</option><option>Daily while active</option></select></Field><div className="border border-red-200 bg-red-50 p-3 text-sm text-red-900">Emergency access must be time-limited, independently reviewed, and fully audited.</div></>}</form></Panel></div>
    <Panel title="Active Administrative Sessions" detail="Current privileged sessions available for revocation"><div className="divide-y divide-slate-100"><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">Ricardo Torres - Master Administrator</p><p className="mt-1 text-xs text-slate-500">Current session - 10.10.2.14 - started today at 8:42 PM</p></div><StatusChip status="Active" /></div><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">System Administration workstation</p><p className="mt-1 text-xs text-slate-500">Previous token invalidated by newer login</p></div><StatusChip status="Terminated" /></div></div></Panel><Toast message={toast} /></div>;
}

function PolicyToggle({ label, detail, checked = false }: Readonly<{ label: string; detail: string; checked?: boolean }>) {
  const inputId = useId();
  return <label htmlFor={inputId} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4"><span><span className="block text-sm font-bold text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></span><input id={inputId} type="checkbox" defaultChecked={checked} aria-label={label} className="mt-1 h-5 w-5 flex-none accent-blue-700" /></label>;
}

function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    auditApi.list(1, 100)
      .then((res) => setLogs(res.data.data))
      .catch(() => setToast('Failed to load audit log.'))
      .finally(() => setLoading(false));
  }, []);

  const rows = logs.filter((log) =>
    `${log.userId} ${log.userRole} ${log.action} ${log.affectedRecordType ?? ''} ${log.affectedRecordId ?? ''} ${log.ipAddress}`.toLowerCase().includes(search.toLowerCase()),
  );

  const uniqueUsers = new Set(logs.map((log) => log.userId)).size;
  const uniqueActions = new Set(logs.map((log) => log.action)).size;

  const handleExport = () => {
    downloadCsv('aimrs-audit-log.csv', rows.map((log) => ({
      Timestamp: new Date(log.timestamp).toISOString(),
      'User ID': log.userId,
      'Role at time': log.userRole,
      Action: log.action,
      'Record type': log.affectedRecordType ?? '',
      'Record ID': log.affectedRecordId ?? '',
      'IP address': log.ipAddress,
    })));
    setToast('Filtered audit log downloaded as CSV.');
  };

  return <div className="space-y-4"><AdminPageHeader title="Audit Log" detail="Inspect append-only evidence of authentication, authorization, asset, requisition, report, and administrative activity." action={<SecondaryButton icon={Download} onClick={handleExport}>Export log</SecondaryButton>} />
    <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3"><Archive className="mt-0.5 h-5 w-5 flex-none text-blue-700" /><div><p className="text-sm font-bold text-blue-950">Immutable audit evidence</p><p className="mt-0.5 text-xs text-blue-800">Audit records cannot be edited or deleted. Every logged action succeeded by definition; timestamps are recorded in UTC.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><MetricCard label="Events loaded" value={String(logs.length)} detail="Most recent audit records from the API" tone="blue" icon={Activity} /><MetricCard label="Unique users" value={String(uniqueUsers)} detail="Distinct accounts represented" tone="blue" icon={KeyRound} /><MetricCard label="Unique actions" value={String(uniqueActions)} detail="Distinct action types represented" tone="blue" icon={FileClock} /></div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="User, role, action, or record" />
    <Panel title="Audit Events" detail={loading ? 'Loading audit events…' : `${rows.length} audit events shown`}>{loading ? <div className="p-6"><LoadingSkeleton rows={8} /></div> : <TableWrap><table className="min-w-[960px] w-full"><thead><tr><th className={thClass}>Timestamp</th><th className={thClass}>User ID</th><th className={thClass}>Role at time</th><th className={thClass}>Action</th><th className={thClass}>Affected record</th><th className={thClass}>IP address</th><th className={`${thClass} text-right`}>Inspect</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No audit logs found.</td></tr> : rows.map((log) => <tr key={log.id} className="hover:bg-slate-50"><td className={tdClass}>{new Date(log.timestamp).toLocaleString()}<span className="block text-xs text-slate-500">{log.id.slice(0, 8)}…</span></td><td className={`${tdClass} font-semibold text-slate-950`}>{log.userId}</td><td className={tdClass}>{log.userRole}</td><td className={`${tdClass} font-mono text-xs`}>{log.action}</td><td className={`${tdClass} font-mono text-xs`}>{log.affectedRecordType ?? '—'} {log.affectedRecordId ? `${log.affectedRecordId.slice(0, 8)}…` : ''}</td><td className={`${tdClass} font-mono text-xs`}>{log.ipAddress}</td><td className={`${tdClass} text-right`}><button type="button" onClick={() => setSelected(log)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Inspect ${log.id}`}><FileClock className="h-4 w-4" /></button></td></tr>)}</tbody></table></TableWrap>}</Panel>
    <DetailDrawer open={Boolean(selected)} title={selected?.action ?? 'Audit event'} onClose={() => setSelected(null)}>{selected && <div className="space-y-4">{[['ID', selected.id], ['Timestamp', new Date(selected.timestamp).toLocaleString()], ['User ID', selected.userId], ['Role at time', selected.userRole], ['Action', selected.action], ['Affected record type', selected.affectedRecordType ?? '—'], ['Affected record ID', selected.affectedRecordId ?? '—'], ['IP address', selected.ipAddress], ['Metadata', selected.metadata ? JSON.stringify(selected.metadata) : '—']].map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm"><span className="capitalize text-slate-500">{key}</span><span className="text-right font-mono text-xs font-semibold">{value}</span></div>)}<Panel title="Event integrity"><div className="space-y-2 p-4 text-xs text-slate-600"><p><strong>Write mode:</strong> Append only</p><p><strong>Update:</strong> Not permitted</p><p><strong>Delete:</strong> Not permitted</p><p><strong>Metadata:</strong> Includes UTC timestamp, user ID, role, source IP, record ID, and safe before/after values where applicable.</p></div></Panel></div>}</DetailDrawer><Toast message={toast} /></div>;
}
