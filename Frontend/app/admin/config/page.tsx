'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  systemConfigApi,
  buildUpdateSystemConfigPayload,
  type SystemConfig,
  type SystemConfigFormValues,
} from '@/lib/api/systemConfig';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

const Section = ({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) => (
  <div className="bg-white rounded-lg shadow-sm border border-blue-200">
    <div className="p-5 border-b border-blue-200 bg-blue-50">
      <h2 className="text-base font-semibold text-[#1a4d7a]">{title}</h2>
    </div>
    <div className="p-6 space-y-4">{children}</div>
  </div>
);

const Field = ({ label, note, children }: Readonly<{ label: string; note?: string; children: React.ReactNode }>) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
  </div>
);

const toForm = (c: SystemConfig): SystemConfigFormValues => ({
  slaApprovalHours: String(c.slaApprovalHours),
  defaultReorderLevel: String(c.defaultReorderLevel),
  maxLoginAttempts: String(c.maxLoginAttempts),
  usefulLifePPE: String(c.usefulLifeYears.PPE),
  usefulLifeSEP: String(c.usefulLifeYears.SEP),
  usefulLifeIES: String(c.usefulLifeYears.IES),
});

export default function SystemConfigPage() {
  const [form, setForm] = useState<SystemConfigFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    systemConfigApi
      .get()
      .then((r) => {
        setForm(toForm(r.data));
        setError('');
      })
      .catch(() => setError('Failed to load configuration. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    // Keep the error branch mounted (don't clear `error`) so the button can show
    // its "Retrying…" state; `load()` clears the error itself on success.
    setLoading(true);
    load();
  };

  const set = (k: keyof SystemConfigFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const r = await systemConfigApi.update(buildUpdateSystemConfigPayload(form));
      setForm(toForm(r.data));
      setSaved(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Failed to save configuration.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="System Configuration" />

      {!form && error ? (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="bg-[#1a4d7a] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : !form ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
          )}
          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-4 py-3">
              Configuration saved.
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <Section title="Requisition SLA">
              <Field label="Requisition Approval SLA (hours)" note="Breach alert fires past this; the pending-approval nudge fires at half of it.">
                <input type="number" min={1} max={168} value={form.slaApprovalHours} onChange={set('slaApprovalHours')} className={inputClass} required />
              </Field>
            </Section>

            <Section title="Inventory Alerts">
              <Field label="Default Low-Stock Reorder Level (units)" note="Fallback threshold for IES supply items that have no per-item reorder level set.">
                <input type="number" min={0} max={100000} value={form.defaultReorderLevel} onChange={set('defaultReorderLevel')} className={inputClass} required />
              </Field>
            </Section>

            <Section title="Replacement — Useful-Life Threshold (years)">
              <Field label="PPE" note="A serviceable asset older than this may be replaced.">
                <input type="number" min={1} max={100} value={form.usefulLifePPE} onChange={set('usefulLifePPE')} className={inputClass} required />
              </Field>
              <Field label="SEP">
                <input type="number" min={1} max={100} value={form.usefulLifeSEP} onChange={set('usefulLifeSEP')} className={inputClass} required />
              </Field>
              <Field label="IES">
                <input type="number" min={1} max={100} value={form.usefulLifeIES} onChange={set('usefulLifeIES')} className={inputClass} required />
              </Field>
            </Section>

            <Section title="Security">
              <Field label="Max Failed Login Attempts" note="Account locks after this many consecutive failures.">
                <input type="number" min={1} max={50} value={form.maxLoginAttempts} onChange={set('maxLoginAttempts')} className={inputClass} required />
              </Field>
            </Section>

            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#1a4d7a] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] disabled:opacity-60 transition-colors">
              <Settings className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
