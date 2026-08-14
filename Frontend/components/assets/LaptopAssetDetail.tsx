'use client';

import { useState } from 'react';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { ActivityTimeline } from '@/components/ui/ActivityTimeline';
import { Toast } from '@/components/ui/Toast';
import { laptopMockRows, type LaptopAssetRecord } from '@/lib/mock/laptops.mock';
import { getWarrantyStatus } from '@/lib/validation/laptop-asset.schema';
import { InventoryLabelPrinter } from '@/components/inventory/InventoryLabelPrinter';

function findLaptop(id?: string): LaptopAssetRecord {
  return laptopMockRows.find((item) => item.assetId === id || item.propertyNumber === id) ?? laptopMockRows[0];
}

function peso(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
}

function ageYears(date: string) {
  return Math.max(0, new Date().getFullYear() - new Date(date).getFullYear());
}

function usefulLifePercent(asset: LaptopAssetRecord) {
  return Math.min(100, Math.round((ageYears(asset.acquisitionDate) / asset.usefulLifeYears) * 100));
}

export function LaptopAssetDetail({ assetId }: { assetId?: string }) {
  const asset = findLaptop(assetId);
  const [tab, setTab] = useState('Overview');
  const [toast, setToast] = useState('');
  const tabs = ['Overview', 'Technical Specifications', 'Assignment History', 'Lifecycle History', 'Maintenance', 'Attachments', 'QR and Barcode'];
  const warrantyStatus = getWarrantyStatus(asset.warrantyExpiryDate);
  const percent = usefulLifePercent(asset);

  const action = (label: string) => {
    if (label === 'Final Disposal') return;
    setToast(`${label} recorded in frontend mock mode.`);
    window.setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="space-y-5">
      <Toast message={toast} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">IT Asset Custodian</p>
          <h1 className="text-2xl font-bold text-slate-950">{asset.brand} {asset.commercialModel}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Property No. {asset.propertyNumber} • Manufacturer Model No.: {asset.manufacturerModelNumber ?? 'Not recorded'} • Serial/Service Tag: {asset.serialNumber || asset.serviceTag}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={asset.status} />
            <StatusBadge status={asset.condition} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Edit Mock Record', 'Generate QR', 'Print Label', 'Record Physical Verification', 'Send for Repair', 'Receive from Repair', 'Transfer', 'Recommend for Disposal'].map((label) => (
            <button key={label} type="button" onClick={() => action(label)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Accountable employee" value={asset.accountableEmployeeName ?? 'Unassigned'} />
        <SummaryCard label="Current location" value={asset.physicalLocation ?? 'Not recorded'} />
        <SummaryCard label="Acquisition date" value={asset.acquisitionDate} />
        <SummaryCard label="Acquisition cost" value={peso(asset.acquisitionCost)} />
        <SummaryCard label="Warranty status" value={warrantyStatus} />
        <SummaryCard label="Useful-life progress" value={`${percent}% used`} />
        <SummaryCard label="Last verification" value={asset.lastPhysicalVerificationDate ?? 'Not recorded'} />
        <SummaryCard label="Current condition" value={asset.condition} />
      </div>

      <ChartCard title="Current Accountability">
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="Issued to" value={asset.accountableEmployeeName ?? 'Unassigned'} />
          <Info label="Employee ID" value={asset.accountableEmployeeId ?? 'Not recorded'} />
          <Info label="Division" value={asset.division ?? 'Not recorded'} />
          <Info label="Office / Section" value={asset.officeOrSection ?? 'Not recorded'} />
          <Info label="Date issued" value={asset.dateIssued ?? 'Not recorded'} />
          <Info label="Issued by" value={asset.issuedBy ?? 'Not recorded'} />
          <Info label="Physical location" value={asset.physicalLocation ?? 'Not recorded'} />
          <Info label="Expected return" value={asset.expectedReturnDate ?? 'Not recorded'} />
          <Info label="Accountability form" value={asset.accountabilityFormType ?? 'None'} />
          <Info label="Form number" value={asset.accountabilityFormNumber ?? 'Not recorded'} />
          <Info label="Acknowledgment" value={asset.acknowledgmentStatus} />
          <Info label="Last known location" value={asset.lastKnownLocation ?? 'Not recorded'} />
        </div>
      </ChartCard>

      {percent >= 100 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          This laptop has exceeded its useful life. IT Asset Custodian may recommend disposal only; final disposal approval is deferred.
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {tabs.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-md px-3 py-2 text-sm font-bold ${tab === item ? 'bg-blue-700 text-white' : 'border border-slate-200 text-slate-700'}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <ChartCard title="Laptop Identity">
          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Display name" value={`${asset.brand} ${asset.commercialModel}`} />
            <Info label="Product release year" value={String(asset.productReleaseYear ?? 'Not recorded')} />
            <Info label="Manufacture year" value={String(asset.manufactureYear ?? 'Not recorded')} />
            <Info label="Acquired by CICC" value={asset.acquisitionDate.slice(0, 4)} />
            <Info label="Manufacturer model no." value={asset.manufacturerModelNumber ?? 'Not recorded'} />
            <Info label="Serial / service tag" value={asset.serialNumber || asset.serviceTag || 'Not recorded'} />
          </div>
        </ChartCard>
      )}

      {tab === 'Technical Specifications' && (
        <ChartCard title="Technical Specifications">
          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Processor" value={asset.processorModel} />
            <Info label="Processor generation" value={asset.processorGeneration ?? 'Not recorded'} />
            <Info label="RAM" value={`${asset.ramCapacityGb} GB ${asset.ramType ?? ''}`} />
            <Info label="Storage" value={`${asset.storageCapacityGb} GB ${asset.storageType}`} />
            <Info label="Graphics" value={`${asset.graphicsType} ${asset.graphicsModel ?? ''}`} />
            <Info label="Operating system" value={asset.operatingSystem} />
            <Info label="Hostname" value={asset.hostname ?? 'Not recorded'} />
            <Info label="MAC address" value={asset.macAddress ?? 'Not recorded'} />
            <Info label="Battery health" value={`${asset.batteryHealthPercent ?? 0}%`} />
          </div>
        </ChartCard>
      )}

      {tab === 'Assignment History' && <ChartCard title="Assignment History"><ActivityTimeline items={asset.assignmentHistory} /></ChartCard>}
      {tab === 'Lifecycle History' && <ChartCard title="Lifecycle History"><ActivityTimeline items={asset.lifecycleHistory} /></ChartCard>}
      {tab === 'Maintenance' && <ChartCard title="Maintenance"><ActivityTimeline items={[asset.lastMaintenanceDate ?? 'No maintenance record yet', `Repair history count: ${asset.repairHistoryCount ?? 0}`]} /></ChartCard>}
      {tab === 'Attachments' && (
        <ChartCard title="Frontend-only Attachments">
          {asset.attachments.length === 0 ? <p className="text-sm text-slate-500">No mock attachments recorded.</p> : asset.attachments.map((item) => <p key={item.id}>{item.fileName}</p>)}
        </ChartCard>
      )}
      {tab === 'QR and Barcode' && (
        <InventoryLabelPrinter
          assets={[
            {
              id: asset.assetId,
              name: `${asset.brand} ${asset.commercialModel}`,
              scope: 'ICT',
              category: 'ICT Equipment',
              type: 'Laptop',
              serialNumber: asset.serialNumber,
              location: asset.physicalLocation ?? 'Not recorded',
              condition: asset.condition === 'Unserviceable' ? 'For Repair' : 'Serviceable',
              status: asset.status,
              acknowledgmentStatus: asset.acknowledgmentStatus,
              notes: asset.itemDescription,
            },
          ]}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-950">{value}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
