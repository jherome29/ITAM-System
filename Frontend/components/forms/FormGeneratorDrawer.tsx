'use client';

import { useCallback, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Field, inputClass, PrimaryButton } from '@/components/admin/AdminUi';
import { textareaClass } from '@/components/ui/controls';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { assetsApi } from '@/lib/api/assets';
import { apiErrorMessage } from '@/lib/api/error-message';
import { reportsApi } from '@/lib/api/reports';
import { requisitionsApi, type Requisition } from '@/lib/api/requisitions';
import { downloadBlob } from '@/lib/download';
import {
  GROUP_META,
  LOSS_TYPES,
  buildFormRequest,
  emptyFormInputs,
  missingInputs,
  type FormDef,
  type FormInputs,
} from '@/lib/forms/form-catalog';
import { assetOption, requisitionMatches, requisitionOption } from '@/lib/forms/picker-options';
import { RecordPicker, type PickerOption } from './RecordPicker';
import { DateField } from '@/components/ui/DateField';

const PICKER_PAGE = 8;
const REQUISITION_WINDOW = 100;

/**
 * The inputs one form needs, in a drawer: pick the asset by what it is, not by
 * its UUID, fill in the few fields the form prints, and download the PDF. The
 * form is stored and numbered on the server either way; the number comes back
 * with the file.
 */
export function FormGeneratorDrawer({
  def,
  onClose,
  onGenerated,
}: Readonly<{
  def: FormDef | null;
  onClose: () => void;
  onGenerated: (result: { def: FormDef; documentNumber: string | null }) => void;
}>) {
  return (
    <DetailDrawer open={Boolean(def)} title={def ? `${def.abbr} — ${def.name}` : 'Generate form'} onClose={onClose}>
      {/* Keyed so that choosing another form starts from empty inputs. */}
      {def && <GeneratorForm key={def.type} def={def} onGenerated={onGenerated} />}
    </DetailDrawer>
  );
}

function GeneratorForm({ def, onGenerated }: Readonly<{ def: FormDef; onGenerated: (result: { def: FormDef; documentNumber: string | null }) => void }>) {
  const [inputs, setInputs] = useState<FormInputs>(emptyFormInputs);
  const [asset, setAsset] = useState<PickerOption | null>(null);
  const [requisition, setRequisition] = useState<PickerOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fulfilled = useRef<Requisition[] | null>(null);

  const set = <K extends keyof FormInputs>(key: K, value: FormInputs[K]) => setInputs((current) => ({ ...current, [key]: value }));

  const searchAssets = useCallback(
    (query: string) => assetsApi.list(1, PICKER_PAGE, query || undefined).then((res) => res.data.data.map(assetOption)),
    [],
  );

  // The fulfilled requisitions are fetched once and then filtered as you type.
  const searchRequisitions = useCallback(async (query: string) => {
    fulfilled.current ??= (await requisitionsApi.list(1, REQUISITION_WINDOW, 'fulfilled')).data.data;
    return fulfilled.current.filter((r) => requisitionMatches(r, query)).slice(0, PICKER_PAGE).map(requisitionOption);
  }, []);

  const missing = missingInputs(def, inputs);
  const group = GROUP_META[def.group];

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (missing.length > 0) return;
    setBusy(true);
    setError('');
    try {
      const { blob, documentNumber } = await reportsApi.generateFormBlob(buildFormRequest(def, inputs));
      downloadBlob(blob, `${documentNumber ?? `${def.type}-${new Date().toISOString().slice(0, 10)}`}.pdf`);
      onGenerated({ def, documentNumber });
    } catch (err) {
      setError(await apiErrorMessage(err, 'The form could not be generated. Check the details and try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void generate(event)} className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-bold uppercase text-slate-500">{def.code}</p>
        <p className="mt-1 text-sm text-slate-700">{def.description}</p>
        <p className="mt-1 text-xs text-slate-500">{group.blurb}</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {def.group === 'asset' && (
        <RecordPicker
          label="Asset"
          required
          placeholder="Search by description, property no. or serial no."
          selected={asset}
          onSelect={(option) => {
            setAsset(option);
            set('assetId', option?.id ?? '');
          }}
          search={searchAssets}
          emptyText="No asset matches."
        />
      )}

      {def.group === 'requisition' && (
        <RecordPicker
          label="Requisition"
          required
          placeholder="Search by request no., requester or item"
          selected={requisition}
          onSelect={(option) => {
            setRequisition(option);
            set('requisitionId', option?.id ?? '');
          }}
          search={searchRequisitions}
          emptyText="No fulfilled requisition matches."
        />
      )}

      {def.group === 'period' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <DateField value={inputs.dateFrom} max={inputs.dateTo || undefined} onChange={(e) => set('dateFrom', e.target.value)} />
          </Field>
          <Field label="To">
            <DateField value={inputs.dateTo} min={inputs.dateFrom || undefined} onChange={(e) => set('dateTo', e.target.value)} />
          </Field>
        </div>
      )}

      {def.inputs.includes('targetOffice') && (
        <Field label="Receiving office / section *">
          <input value={inputs.targetOffice} onChange={(e) => set('targetOffice', e.target.value)} placeholder="e.g. Digital Forensics Section" className={inputClass} />
        </Field>
      )}

      {def.inputs.includes('requestingDivision') && (
        <Field label="Requesting division *">
          <input value={inputs.requestingDivision} onChange={(e) => set('requestingDivision', e.target.value)} placeholder="e.g. Information Technology Division" className={inputClass} />
        </Field>
      )}

      {def.inputs.includes('purpose') && (
        <Field label="Purpose of move-out">
          <input value={inputs.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="e.g. For repair, training use, return to supply" className={inputClass} />
        </Field>
      )}

      {def.inputs.includes('lossType') && (
        <Field label="Type of loss or damage">
          <select value={inputs.lossType} onChange={(e) => set('lossType', e.target.value)} className={inputClass}>
            {LOSS_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </Field>
      )}

      {def.inputs.includes('circumstances') && (
        <Field label="Circumstances">
          <textarea value={inputs.circumstances} onChange={(e) => set('circumstances', e.target.value)} rows={4} placeholder="What happened, where and when." className={textareaClass} />
        </Field>
      )}

      {def.inputs.includes('returnee') && (
        <div>
          <Field label="Returned by (employee ID)">
            <input value={inputs.returneeEmployeeId} onChange={(e) => set('returneeEmployeeId', e.target.value)} placeholder="e.g. CICC-0042" className={inputClass} />
          </Field>
          <p className="mt-1 text-xs text-slate-500">Leave empty to use the asset&apos;s current holder, or the person who last returned it.</p>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Forms that need signatures are printed and signed by hand; the copy stored in AIMRS is the audit reference.
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <PrimaryButton type="submit" icon={Download} disabled={busy || missing.length > 0}>
          {busy ? 'Generating…' : 'Generate & download'}
        </PrimaryButton>
        {missing.length > 0 && <p className="text-xs font-semibold text-slate-500">Still needed: {missing.join(', ')}</p>}
      </div>
    </form>
  );
}
