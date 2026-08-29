'use client';

import { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import type { UpdateSystemConfigPayload } from '@/lib/api/systemConfig';

export interface SystemConfigFormValues {
  slaApprovalHours: string;
  defaultReorderLevel: string;
  maxLoginAttempts: string;
  usefulLifePPE: string;
  usefulLifeSEP: string;
  usefulLifeIES: string;
}

export function buildUpdateSystemConfigPayload(
  v: SystemConfigFormValues,
): UpdateSystemConfigPayload {
  return {
    slaApprovalHours: Number(v.slaApprovalHours),
    defaultReorderLevel: Number(v.defaultReorderLevel),
    maxLoginAttempts: Number(v.maxLoginAttempts),
    usefulLifeYears: {
      PPE: Number(v.usefulLifePPE),
      SEP: Number(v.usefulLifeSEP),
      IES: Number(v.usefulLifeIES),
    },
  };
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d7a]/30 focus:border-[#1a4d7a] transition-colors';

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

export default function SystemConfigPage() {
  const [slaSla, setSlaSla] = useState('24');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [accuracyTarget, setAccuracyTarget] = useState('98');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="System Configuration" />

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-4 py-3 flex items-center gap-2">
          <Save className="w-4 h-4" /> Configuration saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="SLA &amp; Performance Targets">
          <Field label="Requisition Approval SLA (hours)" note="Alert triggered if approval exceeds this threshold.">
            <input type="number" value={slaSla} onChange={(e) => setSlaSla(e.target.value)} min={1} max={168} className={inputClass} />
          </Field>
          <Field label="Inventory Accuracy Target (%)" note="KPI target for physical count reconciliation.">
            <input type="number" value={accuracyTarget} onChange={(e) => setAccuracyTarget(e.target.value)} min={1} max={100} className={inputClass} />
          </Field>
        </Section>

        <Section title="Inventory Alerts">
          <Field label="Low Stock Threshold (units)" note="Notifications sent when asset quantity falls at or below this value.">
            <input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} min={1} className={inputClass} />
          </Field>
        </Section>

        <Section title="Asset Classification Thresholds">
          <Field label="PPE Minimum Acquisition Cost (₱)" note="Assets at or above this value are classified as Property, Plant &amp; Equipment.">
            <input type="number" defaultValue={50000} min={0} className={inputClass} />
          </Field>
          <p className="text-xs text-gray-400">
            Assets below ₱50,000 with useful life &gt; 1 year → Semi-Expendable Property (SEP). Consumables → Inventory/Expendable Supplies (IES).
          </p>
        </Section>

        <div className="flex gap-3">
          <button type="submit" className="flex items-center gap-2 bg-[#1a4d7a] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#143d61] transition-colors">
            <Settings className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
