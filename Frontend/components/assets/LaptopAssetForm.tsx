'use client';

import { useMemo, useState } from 'react';
import type React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import { defaultLaptopAccessories, ictAssetSubtypes } from '@/lib/mock/laptops.mock';
import { mockUsers } from '@/lib/mock/users.mock';
import {
  calculateExpectedReplacementDate,
  getWarrantyStatus,
  laptopAssetSchema,
  type LaptopAssetFormValues,
} from '@/lib/validation/laptop-asset.schema';

export const laptopFormSections = [
  'Basic Information',
  'Technical Specifications',
  'Accessories',
  'Acquisition and Warranty',
  'Assignment and Location',
  'Lifecycle and Condition',
  'Attachments',
  'Review and Submit',
];

const defaultValues: LaptopAssetFormValues = {
  assetSubtype: 'Laptop',
  propertyNumber: '',
  assetCategory: 'ICT Equipment',
  assetType: 'Laptop',
  assetClassification: 'PPE',
  itemDescription: '',
  brand: '',
  productLine: '',
  commercialModel: '',
  manufacturerModelNumber: '',
  serialNumber: '',
  serviceTag: '',
  processorBrand: 'Intel',
  processorModel: '',
  processorGeneration: '',
  ramCapacityGb: 16,
  ramType: 'DDR5',
  ramUpgradeable: true,
  maximumRamGb: 64,
  storageCapacityGb: 512,
  storageType: 'NVMe SSD',
  graphicsType: 'Integrated',
  graphicsModel: '',
  screenSizeInches: 14,
  screenResolution: '1920 x 1080',
  displayType: '',
  operatingSystem: 'Windows 11 Pro',
  osEdition: '',
  osLicenseType: '',
  hostname: '',
  macAddress: '',
  ipAssignment: 'DHCP',
  deviceEncryption: 'Enabled',
  endpointProtection: '',
  batteryHealthPercent: 100,
  technicalRemarks: '',
  accessories: defaultLaptopAccessories,
  acquisitionDate: '',
  acquisitionCost: 0,
  supplier: '',
  usefulLifeYears: 5,
  expectedReplacementDate: '',
  warrantyStartDate: '',
  warrantyExpiryDate: '',
  warrantyProvider: '',
  warrantyType: '',
  accountableEmployeeId: '',
  accountableEmployeeName: '',
  physicalLocation: '',
  accountabilityFormType: 'PAR',
  acknowledgmentStatus: 'Not Required',
  status: 'Registered',
  condition: 'Serviceable',
  replacementEligibility: 'Not Eligible',
  dataSanitizationStatus: 'Not Required',
  remarks: '',
  attachments: [],
};

export function LaptopAssetForm({ onSaved }: Readonly<{ onSaved?: (assetId: string) => void }>) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [toast, setToast] = useState('');
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<LaptopAssetFormValues>({
    resolver: zodResolver(laptopAssetSchema) as Resolver<LaptopAssetFormValues>,
    defaultValues,
    mode: 'onBlur',
  });
  const accessories = useFieldArray({ control, name: 'accessories' });
  const attachments = useFieldArray({ control, name: 'attachments' });
  const values = useWatch({ control }) as LaptopAssetFormValues;
  const isLaptop = values.assetSubtype === 'Laptop';
  const warrantyStatus = getWarrantyStatus(values.warrantyExpiryDate);
  const expectedReplacementDate = useMemo(
    () => calculateExpectedReplacementDate(values.acquisitionDate, Number(values.usefulLifeYears)),
    [values.acquisitionDate, values.usefulLifeYears],
  );

  const save = (mode: 'draft' | 'registered') => {
    handleSubmit((data) => {
      // Frontend-only prototype.
      // Backend persistence and validation will be implemented in a later phase.
      const assetId = data.assetId || `ICT-LT-${Date.now().toString().slice(-4)}`;
      window.localStorage.setItem(`aimrs_mock_laptop_${assetId}`, JSON.stringify({ ...data, assetId, qrCode: `AIMRS:${assetId}`, barcodeValue: assetId }));
      setToast(mode === 'draft' ? 'Mock draft saved locally.' : `Mock laptop ${assetId} registered locally.`);
      onSaved?.(assetId);
    })();
  };

  return (
    <div className="space-y-5">
      <Toast message={toast} />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {laptopFormSections.map((section, index) => (
            <button
              key={section}
              type="button"
              onClick={() => setSectionIndex(index)}
              className={`rounded-md px-3 py-2 text-sm font-bold ${
                index === sectionIndex ? 'bg-blue-700 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {index + 1}. {section}
            </button>
          ))}
        </div>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">{laptopFormSections[sectionIndex]}</h2>
          <p className="mt-1 text-sm text-slate-500">Laptop fields are shown only when the ICT subtype is Laptop.</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {sectionIndex === 0 && (
            <>
              <Select label="ICT subtype" {...register('assetSubtype')}>
                {ictAssetSubtypes.map((type) => <option key={type}>{type}</option>)}
              </Select>
              <Select label="Classification" {...register('assetClassification')} onChange={(event) => {
                setValue('assetClassification', event.target.value as 'PPE' | 'SEP');
                setValue('accountabilityFormType', event.target.value === 'PPE' ? 'PAR' : 'ICS');
              }}>
                <option>PPE</option>
                <option>SEP</option>
              </Select>
              <Field label="Property number" error={errors.propertyNumber?.message} {...register('propertyNumber')} />
              <Field label="Item description" error={errors.itemDescription?.message} {...register('itemDescription')} />
              <Field label="Brand" error={errors.brand?.message} {...register('brand')} />
              <Field label="Product line" help="Example: Latitude, ThinkPad, EliteBook." {...register('productLine')} />
              <Field label="Commercial model" error={errors.commercialModel?.message} {...register('commercialModel')} />
              <Field label="Manufacturer model number" help="Manufacturer internal model, not the commercial name." {...register('manufacturerModelNumber')} />
              <Field label="Serial number" error={errors.serialNumber?.message} {...register('serialNumber')} />
              <Field label="Service tag" {...register('serviceTag')} />
              <Field label="Product release year" type="number" help="Year the model line was released." error={errors.productReleaseYear?.message} {...register('productReleaseYear')} />
              <Field label="Manufacture year" type="number" help="Year this specific unit was manufactured." error={errors.manufactureYear?.message} {...register('manufactureYear')} />
              <Field label="Manufacture date" type="date" {...register('manufactureDate')} />
            </>
          )}

          {sectionIndex === 1 && (
            <>
              {!isLaptop && <p className="md:col-span-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Subtype-specific fields for {values.assetSubtype} are prepared for future configuration. Laptop fields are implemented in this phase.</p>}
              {isLaptop && (
                <>
                  <Select label="Processor brand" {...register('processorBrand')}><option>Intel</option><option>AMD</option><option>Apple</option><option>Other</option></Select>
                  <Field label="Processor model" error={errors.processorModel?.message} {...register('processorModel')} />
                  <Field label="Processor generation" {...register('processorGeneration')} />
                  <Field label="RAM capacity (GB)" type="number" error={errors.ramCapacityGb?.message} {...register('ramCapacityGb')} />
                  <Field label="RAM type" {...register('ramType')} />
                  <Field label="Maximum RAM (GB)" type="number" {...register('maximumRamGb')} />
                  <Field label="Storage capacity (GB)" type="number" error={errors.storageCapacityGb?.message} {...register('storageCapacityGb')} />
                  <Select label="Storage type" {...register('storageType')}><option>HDD</option><option>SATA SSD</option><option>NVMe SSD</option><option>eMMC</option><option>Other</option></Select>
                  <Select label="Graphics type" {...register('graphicsType')}><option>Integrated</option><option>Dedicated</option></Select>
                  <Field label="Graphics model" {...register('graphicsModel')} />
                  <Field label="Screen size" type="number" {...register('screenSizeInches')} />
                  <Field label="Screen resolution" {...register('screenResolution')} />
                  <Field label="Operating system" error={errors.operatingSystem?.message} {...register('operatingSystem')} />
                  <Field label="Hostname" {...register('hostname')} />
                  <Field label="MAC address" error={errors.macAddress?.message} {...register('macAddress')} />
                  <Select label="Device encryption" {...register('deviceEncryption')}><option>Enabled</option><option>Disabled</option><option>Not Applicable</option></Select>
                  <Field label="Endpoint protection" {...register('endpointProtection')} />
                  <Field label="Battery health (%)" type="number" error={errors.batteryHealthPercent?.message} {...register('batteryHealthPercent')} />
                </>
              )}
            </>
          )}

          {sectionIndex === 2 && (
            <div className="md:col-span-2 space-y-3">
              {accessories.fields.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1fr_100px_140px_44px]">
                  <Field label="Accessory" {...register(`accessories.${index}.name`)} />
                  <Field label="Serial" {...register(`accessories.${index}.serialNumber`)} />
                  <Field label="Qty" type="number" {...register(`accessories.${index}.quantity`)} />
                  <Select label="Condition" {...register(`accessories.${index}.condition`)}><option>Serviceable</option><option>Damaged</option><option>Missing</option></Select>
                  <button type="button" onClick={() => accessories.remove(index)} className="mt-7 grid h-10 place-items-center rounded-md border border-slate-200 text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => accessories.append({ id: `ACC-${Date.now()}`, name: '', quantity: 1, condition: 'Serviceable', includedOnIssuance: true })} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add accessory</button>
            </div>
          )}

          {sectionIndex === 3 && (
            <>
              <Field label="Acquisition date" type="date" error={errors.acquisitionDate?.message} {...register('acquisitionDate')} />
              <Field label="Acquisition cost" type="number" error={errors.acquisitionCost?.message} {...register('acquisitionCost')} />
              <Field label="Supplier" error={errors.supplier?.message} {...register('supplier')} />
              <Field label="Useful life years" type="number" error={errors.usefulLifeYears?.message} {...register('usefulLifeYears')} />
              <Field label="Expected replacement date" value={values.expectedReplacementDate || expectedReplacementDate} onChange={(event) => setValue('expectedReplacementDate', event.target.value)} />
              <Field label="Warranty start" type="date" {...register('warrantyStartDate')} />
              <Field label="Warranty expiry" type="date" error={errors.warrantyExpiryDate?.message} {...register('warrantyExpiryDate')} />
              <Field label="Warranty provider" {...register('warrantyProvider')} />
              <Field label="Warranty type" {...register('warrantyType')} />
              <p className={`rounded-lg p-3 text-sm font-bold ${warrantyStatus === 'Expiring Soon' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-700'}`}>Warranty status: {warrantyStatus}</p>
            </>
          )}

          {sectionIndex === 4 && (
            <>
              <Select label="Accountable employee" value={values.accountableEmployeeId} onChange={(event) => {
                const user = mockUsers.find((item) => item.id === event.target.value);
                setValue('accountableEmployeeId', user?.id ?? '');
                setValue('accountableEmployeeName', user?.name ?? '');
              }}>
                <option value="">Unassigned</option>
                {mockUsers.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.office}</option>)}
              </Select>
              <Field label="Accountable employee name" value={values.accountableEmployeeName ?? ''} onChange={(event) => setValue('accountableEmployeeName', event.target.value)} error={errors.accountableEmployeeId?.message} />
              <Field label="Division" {...register('division')} />
              <Field label="Office / Section" {...register('officeOrSection')} />
              <Field label="Physical location" {...register('physicalLocation')} />
              <Select label="Accountability form" {...register('accountabilityFormType')}><option>PAR</option><option>ICS</option><option>None</option></Select>
              <Field label="Form number" {...register('accountabilityFormNumber')} />
              <Select label="Acknowledgment status" {...register('acknowledgmentStatus')}><option>Not Required</option><option>Pending</option><option>Acknowledged</option></Select>
            </>
          )}

          {sectionIndex === 5 && (
            <>
              <Select label="Status" {...register('status')}><option>Registered</option><option>Available</option><option>Reserved</option><option>Issued</option><option>Under Repair</option><option>For Disposal Review</option><option>Lost</option><option>Stolen</option><option>Damaged</option></Select>
              <Select label="Condition" {...register('condition')}><option>Serviceable</option><option>For Repair</option><option>Unserviceable</option><option>For Disposal</option></Select>
              <Select label="Replacement eligibility" {...register('replacementEligibility')}><option>Not Eligible</option><option>Eligible by Age</option><option>Eligible by Condition</option><option>Eligible by Damage</option><option>For Technical Assessment</option></Select>
              <Select label="Data sanitization" {...register('dataSanitizationStatus')}><option>Not Required</option><option>Pending</option><option>Completed</option></Select>
              <label className="md:col-span-2 text-sm font-semibold text-slate-700">Remarks<textarea {...register('remarks')} className="mt-2 h-24 w-full rounded-md border border-slate-200 p-3 text-sm" /></label>
            </>
          )}

          {sectionIndex === 6 && (
            <div className="md:col-span-2 space-y-3">
              {attachments.fields.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_220px_120px_44px]">
                  <Field label="File name" {...register(`attachments.${index}.fileName`)} />
                  <Field label="Document type" {...register(`attachments.${index}.documentType`)} />
                  <Field label="File size" type="number" {...register(`attachments.${index}.fileSize`)} />
                  <button type="button" onClick={() => attachments.remove(index)} className="mt-7 grid h-10 place-items-center rounded-md border border-slate-200 text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => attachments.append({ id: `ATT-${Date.now()}`, fileName: 'mock-document.pdf', documentType: 'Warranty Document', uploadedAt: new Date().toISOString(), uploadedBy: 'Paolo Cruz', fileSize: 240000 })} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add mock attachment</button>
              <p className="text-sm text-slate-500">Attachments store metadata only. No backend upload is performed.</p>
            </div>
          )}

          {sectionIndex === 7 && (
            <div className="md:col-span-2 space-y-4">
              <div className="grid gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-3">
                <Summary label="Model" value={`${values.brand || '-'} ${values.commercialModel || ''}`} />
                <Summary label="Manufacturer Model No." value={values.manufacturerModelNumber || '-'} />
                <Summary label="Serial / Service Tag" value={values.serialNumber || values.serviceTag || '-'} />
                <Summary label="Product Release Year" value={String(values.productReleaseYear ?? '-')} />
                <Summary label="Manufacture Year" value={String(values.manufactureYear ?? '-')} />
                <Summary label="Acquired by CICC" value={values.acquisitionDate?.slice(0, 4) || '-'} />
                <Summary label="Processor" value={values.processorModel || '-'} />
                <Summary label="RAM" value={`${values.ramCapacityGb} GB ${values.ramType ?? ''}`} />
                <Summary label="Storage" value={`${values.storageCapacityGb} GB ${values.storageType}`} />
                <Summary label="Warranty" value={warrantyStatus} />
                <Summary label="Status" value={values.status} />
                <Summary label="Condition" value={values.condition} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSectionIndex(0)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Back</button>
                <button type="button" onClick={() => save('draft')} className="rounded-md border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700">Save as Mock Draft</button>
                <button type="button" onClick={() => save('registered')} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Check className="h-4 w-4" /> Register Mock Asset</button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-between border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" disabled={sectionIndex === 0} onClick={() => setSectionIndex((value) => Math.max(0, value - 1))} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">Back</button>
          <button type="button" disabled={sectionIndex === laptopFormSections.length - 1} onClick={() => setSectionIndex((value) => Math.min(laptopFormSections.length - 1, value + 1))} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next</button>
        </div>
      </form>
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; help?: string };

function Field({ label, error, help, ...props }: InputProps) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input {...props} className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode };

function Select({ label, children, ...props }: SelectProps) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select {...props} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
        {children}
      </select>
    </label>
  );
}

function Summary({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
