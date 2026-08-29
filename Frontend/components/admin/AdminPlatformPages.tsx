'use client';

import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';
import { Activity, Archive, CheckCircle2, Clock3, Database, Download, FileClock, KeyRound, LockKeyhole, Plus, RefreshCw, Save, Server, ShieldCheck } from 'lucide-react';
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
import { masterDataGroups, scheduledJobs, systemEvents } from '@/lib/mock/admin.mock';
import { ActionMenu, AdminPageHeader, Field, inputClass, MetricCard, Panel, PrimaryButton, SearchToolbar, SecondaryButton, StatusChip, TableWrap, tdClass, thClass } from './AdminUi';

type PlatformSlug = 'reference-data' | 'configuration' | 'technical-logs' | 'security' | 'audit';

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
  if (slug === 'reference-data') return <MasterDataPage />;
  if (slug === 'configuration') return <SystemSettingsPage />;
  if (slug === 'technical-logs') return <SystemHealthPage />;
  if (slug === 'security') return <SecurityPoliciesPage />;
  return <AuditLogPage />;
}

function MasterDataPage() {
  const [groups, setGroups] = useState(masterDataGroups);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<(typeof masterDataGroups)[number] | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const rows = groups.filter((group) => (filter === 'All' || group.status === filter) && Object.values(group).join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4"><AdminPageHeader title="Master Data" detail="Maintain controlled values used across asset registration, lifecycle workflows, reports, locations, and official forms." action={<PrimaryButton icon={Plus} onClick={() => setCreating(true)}>Add reference set</PrimaryButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Reference groups" value="6" detail="90 controlled values" tone="blue" icon={Database} /><MetricCard label="Protected groups" value="2" detail="System-required values" tone="green" icon={LockKeyhole} /><MetricCard label="Review due" value="1" detail="Location directory" tone="amber" icon={Clock3} /><MetricCard label="Dependency errors" value="0" detail="No orphaned references" tone="green" icon={CheckCircle2} /></div>
    <SearchToolbar value={search} onChange={setSearch} filterLabel="All reference sets" filterValue={filter} filterOptions={['All', 'Healthy', 'Protected', 'Review due']} onFilterChange={setFilter} />
    <div className="grid min-w-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"><Panel title="Reference Groups" detail="Select a controlled domain"><nav className="p-2" aria-label="Master data groups">{groups.map((group) => <button key={group.id} type="button" onClick={() => setSelected(group)} className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm ${selected?.id === group.id ? 'bg-blue-50 font-bold text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}><span>{group.name}</span><span className="text-xs text-slate-400">{group.records}</span></button>)}</nav></Panel><Panel title="Controlled Reference Sets" detail="Codes cannot be duplicated; protected values cannot be deleted"><TableWrap><table className="min-w-[920px] w-full"><thead><tr><th className={thClass}>Reference set</th><th className={thClass}>Records</th><th className={thClass}>Used by</th><th className={thClass}>Owner</th><th className={thClass}>Last changed</th><th className={thClass}>Health</th><th className={`${thClass} text-right`}>Actions</th></tr></thead><tbody>{rows.map((group) => <tr key={group.id} className="hover:bg-slate-50"><td className={tdClass}><button type="button" onClick={() => setSelected(group)} className="text-left font-bold text-slate-950">{group.name}<span className="block text-xs font-normal text-slate-500">{group.id}</span></button></td><td className={tdClass}>{group.records}</td><td className={tdClass}>{group.usedBy}</td><td className={tdClass}>{group.owner}</td><td className={tdClass}>{group.lastChanged}</td><td className={tdClass}><StatusChip status={group.status} /></td><td className={`${tdClass} text-right`}><ActionMenu actions={[{ label: 'Manage values', onClick: () => setSelected(group) }, { label: 'Export values', onClick: () => { downloadCsv(`${group.id.toLowerCase()}.csv`, [{ code: `${group.id}-001`, name: 'Sample active value', status: 'Active' }, { code: `${group.id}-002`, name: 'Protected system value', status: 'Protected' }]); setToast(`${group.name} CSV downloaded.`); } }, { label: 'View dependencies', onClick: () => setToast(`${group.records} values checked; dependencies are shown in the detail panel.`) }]} /></td></tr>)}</tbody></table></TableWrap></Panel></div>
    <DetailDrawer open={Boolean(selected)} title={selected?.name ?? 'Reference set'} onClose={() => setSelected(null)}>{selected && <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[['Values', String(selected.records)], ['Owner', selected.owner], ['Used by', selected.usedBy], ['Last changed', selected.lastChanged]].map(([label, value]) => <div key={label} className="border border-slate-200 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div><Panel title="Sample values"><div className="divide-y divide-slate-100 px-4">{['Active value 01', 'Active value 02', 'Protected system value'].map((value, index) => <div key={value} className="flex items-center justify-between py-3 text-sm"><span><strong>{`CODE-${index + 1}`}</strong> - {value}</span><StatusChip status={index === 2 ? 'Protected' : 'Active'} /></div>)}</div></Panel><div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">A value in use must be deactivated or replaced; deleting it could invalidate historical asset and form records.</div><PrimaryButton onClick={() => { setGroups((current) => current.map((group) => group.id === selected.id ? { ...group, records: group.records + 1, lastChanged: 'Today' } : group)); setSelected((current) => current ? { ...current, records: current.records + 1, lastChanged: 'Today' } : current); setToast(`A new value was added to ${selected.name} in frontend mock state.`); }}>Add value</PrimaryButton></div>}</DetailDrawer>
    <DetailDrawer open={creating} title="Add reference set" onClose={() => setCreating(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const group = { id: `REF-${String(groups.length + 1).padStart(3, '0')}`, name: String(data.get('name')), records: 0, usedBy: String(data.get('usedBy')), lastChanged: 'Today', owner: String(data.get('owner')), status: 'Healthy' }; setGroups((current) => [...current, group]); setCreating(false); setToast(`${group.name} reference set was created in frontend mock state.`); }}><Field label="Reference set name"><input name="name" required className={inputClass} /></Field><Field label="Used by"><input name="usedBy" required className={inputClass} placeholder="Modules or workflows that consume this data" /></Field><Field label="Data owner"><input name="owner" required className={inputClass} /></Field><PrimaryButton type="submit">Create reference set</PrimaryButton></form></DetailDrawer><Toast message={toast} /></div>;
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

function SystemHealthPage() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'Events' | 'Scheduled Jobs'>('Events');
  const [selected, setSelected] = useState<(typeof systemEvents)[number] | null>(null);
  const [toast, setToast] = useState('');
  const events = useMemo(() => systemEvents.filter((event) => Object.values(event).join(' ').toLowerCase().includes(search.toLowerCase())), [search]);
  return <div className="space-y-4"><AdminPageHeader title="System Health & Jobs" detail="Monitor platform services, diagnostic events, and scheduled automation without mixing them with user audit evidence." action={<SecondaryButton icon={RefreshCw} onClick={() => setToast('Health checks refreshed.')}>Refresh checks</SecondaryButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Frontend" value="Available" detail="HTTP 200 - 42 ms" tone="green" icon={CheckCircle2} /><MetricCard label="Backend API" value="Starting" detail="Waiting for database" tone="amber" icon={Server} /><MetricCard label="Database" value="Unavailable" detail="Tenant/user not found" tone="red" icon={Database} /><MetricCard label="Scheduled jobs" value="3" detail="One completed with warning" tone="amber" icon={Clock3} /></div>
    <div className="flex border-b border-slate-200" role="tablist">{(['Events', 'Scheduled Jobs'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-2 text-sm font-bold ${tab === item ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}>{item}</button>)}</div>
    {tab === 'Events' ? <><SearchToolbar value={search} onChange={setSearch} filterLabel="All technical events" /><Panel title="Technical Events" detail="Runtime and service diagnostics; sensitive fields are never displayed"><TableWrap><table className="min-w-[1120px] w-full"><thead><tr><th className={thClass}>Timestamp</th><th className={thClass}>Severity</th><th className={thClass}>Service</th><th className={thClass}>Event</th><th className={thClass}>Correlation ID</th><th className={thClass}>Duration</th><th className={thClass}>Status</th><th className={`${thClass} text-right`}>Actions</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="hover:bg-slate-50"><td className={tdClass}>{event.timestamp}<span className="block text-xs text-slate-500">{event.id}</span></td><td className={tdClass}><StatusChip status={event.severity} /></td><td className={tdClass}>{event.service}</td><td className={tdClass}>{event.event}</td><td className={`${tdClass} font-mono text-xs`}>{event.correlationId}</td><td className={tdClass}>{event.duration}</td><td className={tdClass}><StatusChip status={event.status} /></td><td className={`${tdClass} text-right`}><ActionMenu actions={[{ label: 'Inspect event', onClick: () => setSelected(event) }, { label: 'Copy correlation ID', onClick: () => { void navigator.clipboard.writeText(event.correlationId); setToast(`${event.correlationId} copied.`); } }, { label: 'Mark reviewed', onClick: () => setToast(`${event.id} marked reviewed in mock state.`) }]} /></td></tr>)}</tbody></table></TableWrap></Panel></> : <Panel title="Scheduled Jobs" detail="Automation schedule, execution duration, and latest result"><TableWrap><table className="min-w-[960px] w-full"><thead><tr><th className={thClass}>Job</th><th className={thClass}>Schedule</th><th className={thClass}>Last run</th><th className={thClass}>Next run</th><th className={thClass}>Duration</th><th className={thClass}>Result</th><th className={`${thClass} text-right`}>Actions</th></tr></thead><tbody>{scheduledJobs.map((job) => <tr key={job.id}><td className={`${tdClass} font-bold text-slate-950`}>{job.name}<span className="block text-xs font-normal text-slate-500">{job.id}</span></td><td className={tdClass}>{job.schedule}</td><td className={tdClass}>{job.lastRun}</td><td className={tdClass}>{job.nextRun}</td><td className={tdClass}>{job.duration}</td><td className={tdClass}><StatusChip status={job.result} /></td><td className={`${tdClass} text-right`}><ActionMenu actions={[{ label: 'View history', onClick: () => setToast(`${job.name} completed successfully on its two previous runs.`) }, { label: 'Run now', onClick: () => setToast(`${job.name} queued for execution in frontend mock state.`) }]} /></td></tr>)}</tbody></table></TableWrap></Panel>}
    <DetailDrawer open={Boolean(selected)} title={selected?.event ?? 'Technical event'} onClose={() => setSelected(null)}>{selected && <div className="space-y-4">{Object.entries(selected).map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm"><span className="capitalize text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</span><span className="text-right font-mono text-xs font-semibold">{value}</span></div>)}<div className="border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Use the correlation ID to connect related service events. Credentials, tokens, request bodies, and stack traces are intentionally excluded.</div></div>}</DetailDrawer><Toast message={toast} /></div>;
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
