'use client';

import { ArrowRight, FileText } from 'lucide-react';
import { FORM_CATALOG, GROUP_META, type FormDef, type FormGroup } from '@/lib/forms/form-catalog';

const GROUP_ORDER: FormGroup[] = ['asset', 'requisition', 'period'];

/** Every form the system can generate, by what it is generated for. Choosing one opens its inputs. */
export function FormCatalog({ onChoose }: Readonly<{ onChoose: (def: FormDef) => void }>) {
  return (
    <div className="space-y-6">
      {GROUP_ORDER.map((group) => {
        const forms = FORM_CATALOG.filter((f) => f.group === group);
        return (
          <section key={group} aria-labelledby={`catalog-${group}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`catalog-${group}`} className="text-sm font-bold text-slate-950">
                {GROUP_META[group].label}
                <span className="ml-2 text-xs font-semibold text-slate-400">{forms.length}</span>
              </h2>
              <p className="text-xs text-slate-500">{GROUP_META[group].blurb}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {forms.map((form) => (
                <button
                  key={form.type}
                  type="button"
                  onClick={() => onChoose(form)}
                  className="group flex h-full flex-col rounded-lg border border-slate-200/90 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">{form.code}</span>
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                      <FileText className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-slate-950">{form.abbr}</p>
                  <p className="text-sm font-semibold text-slate-700">{form.name}</p>
                  <p className="mt-1 flex-1 text-xs text-slate-500">{form.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700">
                    Generate
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
