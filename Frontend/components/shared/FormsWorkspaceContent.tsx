'use client';

import { useEffect, useState } from 'react';
import { Archive, Clock, FileText, Files } from 'lucide-react';
import { AdminPageHeader, MetricCard } from '@/components/admin/AdminUi';
import { FormCatalog } from '@/components/forms/FormCatalog';
import { FormGeneratorDrawer } from '@/components/forms/FormGeneratorDrawer';
import { FormsArchive } from '@/components/forms/FormsArchive';
import { Toast } from '@/components/ui/Toast';
import { reportsApi, type FormMeta } from '@/lib/api/reports';
import { FORM_CATALOG, formTypeLabel, type FormDef } from '@/lib/forms/form-catalog';
import { formatDate } from '@/lib/dates';

type Tab = 'generate' | 'archive';

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: 'generate', label: 'Generate a form', icon: FileText },
  { id: 'archive', label: 'Forms archive', icon: Archive },
];


/**
 * Reports & Forms: the official COA / CICC forms. Custodians generate them from
 * the catalogue and find every form already on file in the archive; the
 * oversight role (Management) gets the archive alone.
 */
export function FormsWorkspaceContent({ eyebrow, canGenerate = true }: Readonly<{ eyebrow: string; canGenerate?: boolean }>) {
  const [tab, setTab] = useState<Tab>(canGenerate ? 'generate' : 'archive');
  const [chosen, setChosen] = useState<FormDef | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<{ total: number; latest: FormMeta | null } | null>(null);
  const [toast, setToast] = useState('');

  const generated = ({ def, documentNumber }: { def: FormDef; documentNumber: string | null }) => {
    setChosen(null);
    setRefreshKey((key) => key + 1);
    setToast(documentNumber ? `${def.abbr} ${documentNumber} generated and filed.` : `${def.abbr} generated and filed.`);
  };

  // The summary cards are about the whole archive, whichever tab is showing.
  useEffect(() => {
    let current = true;
    reportsApi
      .forms(1, 1)
      .then((res) => {
        if (current) setSummary({ total: res.data.total, latest: res.data.data[0] ?? null });
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [refreshKey]);

  const latest = summary?.latest ?? null;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        eyebrow={eyebrow}
        title="Reports & Forms"
        detail={
          canGenerate
            ? 'Generate the official COA / CICC forms from live records. Every form is numbered where the manual requires it and filed in the archive.'
            : 'Every official COA / CICC form generated in AIMRS, with its number and who issued it. Read-only.'
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Forms on file" value={summary ? summary.total.toLocaleString('en-PH') : '—'} detail="Stored with their PDF for audit" tone="blue" icon={Archive} />
        <MetricCard
          label="Last generated"
          value={latest ? formatDate(latest.generatedAt) : '—'}
          detail={latest ? `${formTypeLabel(latest.formType)}${latest.documentNumber ? ` · ${latest.documentNumber}` : ''}` : 'Nothing generated yet'}
          tone="slate"
          icon={Clock}
        />
        <MetricCard label="Form types" value={String(FORM_CATALOG.length)} detail="Asset, requisition and period forms" tone="green" icon={Files} />
      </div>

      {canGenerate && (
        <div role="tablist" aria-label="Reports and forms" className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`forms-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`forms-panel-${id}`}
              onClick={() => setTab(id)}
              className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                tab === id ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {canGenerate && tab === 'generate' && (
        <div role="tabpanel" id="forms-panel-generate" aria-labelledby="forms-tab-generate">
          <FormCatalog onChoose={setChosen} />
        </div>
      )}

      {(tab === 'archive' || !canGenerate) && (
        <div role={canGenerate ? 'tabpanel' : undefined} id="forms-panel-archive" aria-labelledby={canGenerate ? 'forms-tab-archive' : undefined}>
          <FormsArchive refreshKey={refreshKey} />
        </div>
      )}

      {canGenerate && <FormGeneratorDrawer def={chosen} onClose={() => setChosen(null)} onGenerated={generated} />}
      <Toast message={toast} />
    </div>
  );
}
