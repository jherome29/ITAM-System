'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { Archive, Boxes, Car, Check, ChevronLeft, ChevronRight, FileText, Grid2X2, ImagePlus, Laptop, List, MapPin, Package, Plus, Printer, QrCode, Save, Search, Server, Upload, Wifi } from 'lucide-react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Toast } from '@/components/ui/Toast';
import { Field, inputClass, PrimaryButton, StatusChip } from '@/components/admin/AdminUi';
import { assetMockRows, type MockAsset, type MockAssetScope } from '@/lib/mock/assets.mock';

type InventoryKind = 'ict' | 'property' | 'supply';

const activeHrefByKind: Record<InventoryKind, string> = {
  ict: '/it-asset-custodian/assets',
  property: '/property-custodian/fixed-assets',
  supply: '/property-custodian/supplies',
};

const categoryOptionsByKind: Record<InventoryKind, string[]> = {
  ict: ['ICT Equipment', 'Network Equipment', 'Communication Devices', 'Forensic Tools'],
  property: ['Office Equipment', 'Furniture', 'Motor Vehicles', 'Building Equipment'],
  supply: ['Office Supplies', 'Evidence Supplies', 'Printing Supplies', 'Technical Supplies'],
};

const idPrefixByScope: Record<MockAssetScope, string> = {
  ICT: 'ICT',
  PROPERTY: 'PPE',
  SUPPLY: 'SUP',
};

const typePlaceholderByKind: Record<InventoryKind, string> = {
  ict: 'Laptop, printer, switch',
  property: 'Furniture, vehicle, equipment',
  supply: 'Consumable',
};

function stepBadgeClass(complete: boolean, active: boolean) {
  if (complete) return 'bg-emerald-600 text-white';
  if (active) return 'bg-blue-700 text-white';
  return 'bg-slate-100 text-slate-500';
}

const pageConfig: Record<InventoryKind, { eyebrow: string; title: string; detail: string; scope: MockAssetScope; action: string }> = {
  ict: { eyebrow: 'IT Asset Custodian', title: 'ICT Asset Registry', detail: 'Manage devices, ownership, serviceability, warranty, and lifecycle records.', scope: 'ICT', action: 'Add asset' },
  property: { eyebrow: 'Property Custodian', title: 'Fixed Asset Registry', detail: 'Manage accountable property, locations, assignments, and physical condition.', scope: 'PROPERTY', action: 'Add property' },
  supply: { eyebrow: 'Property Custodian', title: 'Supply Inventory', detail: 'Monitor stock on hand, reorder levels, storage locations, and supply movement.', scope: 'SUPPLY', action: 'Record stock' },
};

const tabs: Record<InventoryKind, Array<{ label: string; href: string }>> = {
  ict: [
    { label: 'Asset registry', href: '/it-asset-custodian/assets' },
    { label: 'Physical inventory', href: '/it-asset-custodian/physical-inventory' },
    { label: 'Maintenance & repair', href: '/it-asset-custodian/maintenance' },
  ],
  property: [
    { label: 'Fixed assets', href: '/property-custodian/fixed-assets' },
    { label: 'Supplies', href: '/property-custodian/supplies' },
    { label: 'Physical inventory', href: '/property-custodian/physical-inventory' },
  ],
  supply: [
    { label: 'Fixed assets', href: '/property-custodian/fixed-assets' },
    { label: 'Supplies', href: '/property-custodian/supplies' },
    { label: 'Physical inventory', href: '/property-custodian/physical-inventory' },
  ],
};

function AssetIcon({ asset, className }: { asset: MockAsset; className: string }) {
  if (asset.photoUrl) return <Image src={asset.photoUrl} alt={asset.name} width={112} height={112} unoptimized className={`${className} object-cover`} />;
  const text = `${asset.category} ${asset.type}`.toLowerCase();
  if (text.includes('laptop') || text.includes('workstation')) return <Laptop className={className} />;
  if (text.includes('printer')) return <Printer className={className} />;
  if (text.includes('server') || text.includes('storage')) return <Server className={className} />;
  if (text.includes('network') || text.includes('switch') || text.includes('router')) return <Wifi className={className} />;
  if (text.includes('vehicle')) return <Car className={className} />;
  if (asset.scope === 'SUPPLY') return <Package className={className} />;
  if (text.includes('cabinet') || text.includes('furniture')) return <Archive className={className} />;
  return <Boxes className={className} />;
}

function lifecycleText(asset: MockAsset) {
  if (asset.scope === 'SUPPLY') return `${asset.stockOnHand ?? 0} ${asset.unit ?? 'units'} on hand · Reorder at ${asset.reorderLevel ?? 0}`;
  if (asset.warrantyExpiry) return `Warranty expires ${asset.warrantyExpiry}`;
  return `${asset.condition} · ${asset.status}`;
}

export function AssetInventoryGallery({ kind }: { kind: InventoryKind }) {
  const config = pageConfig[kind];
  const [assets, setAssets] = useState(() => assetMockRows.filter((asset) => asset.scope === config.scope));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MockAsset | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const pageSize = 6;
  const categories = useMemo(() => ['All', ...new Set(assets.map((asset) => asset.category))], [assets]);
  const statuses = useMemo(() => ['All', ...new Set(assets.map((asset) => asset.status))], [assets]);
  const filtered = assets.filter((asset) => {
    const matchesText = Object.values(asset).join(' ').toLowerCase().includes(search.trim().toLowerCase());
    return matchesText && (category === 'All' || asset.category === category) && (status === 'All' || asset.status === status);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeHref = activeHrefByKind[kind];

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase text-blue-700">{config.eyebrow}</p><h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">{config.title}</h1><p className="mt-1 max-w-3xl text-sm text-slate-600">{config.detail}</p></div>
      <div className="flex flex-wrap gap-2"><Link href={kind === 'ict' ? '/it-asset-custodian/qr-scanner' : '/property-custodian/qr-scanner'} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><QrCode className="h-4 w-4" />Scan tag</Link><PrimaryButton icon={Plus} onClick={() => setCreating(true)}>{config.action}</PrimaryButton></div>
    </header>

    <nav aria-label="Inventory sections" className="flex gap-6 overflow-x-auto border-b border-slate-200">{tabs[kind].map((tab) => <Link key={tab.href} href={tab.href} className={`relative flex h-11 flex-none items-center text-sm font-semibold ${tab.href === activeHref ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}>{tab.label}{tab.href === activeHref && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />}</Link>)}</nav>

    <section className="space-y-4 rounded-lg border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">Search inventory</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${kind === 'supply' ? 'supplies' : 'assets'} by name, ID, serial, or location`} className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
        <div className="flex flex-col gap-2 sm:flex-row"><select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-10 min-w-44 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500">{categories.map((item) => <option key={item}>{item === 'All' ? 'All categories' : item}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 min-w-40 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500">{statuses.map((item) => <option key={item}>{item === 'All' ? 'All statuses' : item}</option>)}</select><div className="flex h-10 overflow-hidden rounded-md border border-slate-200" aria-label="Inventory view"><button type="button" onClick={() => setView('list')} className={`grid w-10 place-items-center ${view === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} aria-label="List view" title="List view"><List className="h-4 w-4" /></button><button type="button" onClick={() => setView('grid')} className={`grid w-10 place-items-center border-l border-slate-200 ${view === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} aria-label="Grid view" title="Grid view"><Grid2X2 className="h-4 w-4" /></button></div></div>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-bold text-slate-950">{kind === 'supply' ? 'Supplies' : 'Assets'} <span className="font-medium text-slate-400">({filtered.length})</span></h2><p className="mt-1 text-xs text-slate-500">Showing {visible.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filtered.length)} of {filtered.length} records</p></div><div className="flex items-center gap-1 text-sm"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="h-8 rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:text-slate-300">Previous</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => <button type="button" key={item} onClick={() => setPage(item)} className={`h-8 min-w-8 rounded-md px-2 font-semibold ${page === item ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item}</button>)}<button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} className="h-8 rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:text-slate-300">Next</button></div></div>
    </section>

    <InventoryResults visible={visible} view={view} onOpen={setSelected} />

    <DetailDrawer open={Boolean(selected)} title={selected?.name ?? 'Inventory record'} onClose={() => setSelected(null)}>{selected && <AssetDetails asset={selected} />}</DetailDrawer>
    <DetailDrawer open={creating} title={config.action} onClose={() => setCreating(false)}><CreateInventoryRecord kind={kind} onSubmit={(asset) => { setAssets((current) => [asset, ...current]); setCreating(false); setToast(asset.status === 'Registered' ? `${asset.id} was saved as a draft record.` : `${asset.id} was added to ${config.title}.`); }} /></DetailDrawer>
    <Toast message={toast} />
  </div>;
}

function InventoryResults({
  visible,
  view,
  onOpen,
}: {
  visible: MockAsset[];
  view: 'grid' | 'list';
  onOpen: (asset: MockAsset) => void;
}) {
  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <Search className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-3 text-sm font-bold text-slate-900">No matching records</p>
        <p className="mt-1 text-xs text-slate-500">Adjust the search or filters to see more inventory.</p>
      </div>
    );
  }
  if (view === 'grid') {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((asset) => <AssetCard key={asset.id} asset={asset} onOpen={() => onOpen(asset)} />)}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {visible.map((asset) => <AssetListRow key={asset.id} asset={asset} onOpen={() => onOpen(asset)} />)}
      </div>
    </div>
  );
}

function AssetCard({ asset, onOpen }: { asset: MockAsset; onOpen: () => void }) {
  const attention = asset.status === 'Under Repair' || asset.status === 'Damaged' || asset.condition === 'Low Stock';
  return <button type="button" onClick={onOpen} className="group min-h-40 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className="flex h-full"><span className="grid w-28 flex-none place-items-center bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700"><AssetIcon asset={asset} className="h-10 w-10" /></span><span className="flex min-w-0 flex-1 flex-col p-4"><span className="line-clamp-2 text-sm font-bold leading-5 text-slate-950">{asset.name}</span><span className="mt-1 block text-xs text-slate-500">{asset.id}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-slate-600"><i className={`h-1.5 w-1.5 rounded-full ${attention ? 'bg-red-500' : 'bg-emerald-500'}`} />{asset.type} · {asset.status}</span><span className="mt-auto block"><span className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{asset.location}</span><span className={`mt-2 block truncate text-xs font-semibold ${attention ? 'text-red-600' : 'text-emerald-700'}`}>{lifecycleText(asset)}</span></span></span></div></button>;
}

function AssetListRow({ asset, onOpen }: { asset: MockAsset; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="grid w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[44px_minmax(0,1fr)_180px_180px_auto] sm:items-center"><span className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-600"><AssetIcon asset={asset} className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-950">{asset.name}</span><span className="text-xs text-slate-500">{asset.id} · {asset.serialNumber}</span></span><span className="text-xs text-slate-600">{asset.category}</span><span className="inline-flex items-center gap-1 text-xs text-slate-600"><MapPin className="h-3.5 w-3.5" />{asset.location}</span><StatusChip status={asset.status} /></button>;
}

function AssetDetails({ asset }: { asset: MockAsset }) {
  const fields = [['Inventory ID', asset.id], ['Scope', asset.scope], ['Category', asset.category], ['Type', asset.type], ['Serial number', asset.serialNumber], ['Location', asset.location], ['Assigned to', asset.assignedTo ?? 'Unassigned'], ['Condition', asset.condition], ['Status', asset.status], ['Issued date', asset.issuedDate ?? 'Not issued'], ['Warranty expiry', asset.warrantyExpiry ?? 'Not recorded']];
  return <div className="space-y-5"><div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4"><span className="grid h-14 w-14 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><AssetIcon asset={asset} className="h-6 w-6" /></span><div><p className="text-lg font-bold text-slate-950">{asset.name}</p><p className="mt-1 text-sm text-slate-500">{asset.id} · {asset.type}</p></div></div><dl className="grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd></div>)}</dl><div><p className="text-xs font-semibold text-slate-500">Notes</p><p className="mt-1 text-sm leading-6 text-slate-700">{asset.notes}</p></div></div>;
}

function CreateInventoryRecord({ kind, onSubmit }: { kind: InventoryKind; onSubmit: (asset: MockAsset) => void }) {
  const config = pageConfig[kind];
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  const [review, setReview] = useState<Record<string, string>>({});
  const categoryOptions = categoryOptionsByKind[kind];
  const steps = ['Asset details', kind === 'supply' ? 'Stock & sourcing' : 'Procurement', 'Photos & review'];

  const nextStep = () => {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const controls = Array.from(section?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? []);
    if (!controls.every((control) => control.reportValidity())) return;
    if (step === 2 && formRef.current) {
      const values: Record<string, string> = {};
      new FormData(formRef.current).forEach((value, key) => { if (typeof value === 'string') values[key] = value; });
      setReview(values);
    }
    setStep((current) => Math.min(3, current + 1));
  };

  return <form ref={formRef} className="space-y-5" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const draft = submitter?.value === 'draft';
    const asset: MockAsset = {
      id: `${idPrefixByScope[config.scope]}-${String(Date.now()).slice(-5)}`,
      name: String(data.get('name')),
      scope: config.scope,
      category: String(data.get('category')),
      type: String(data.get('type')),
      serialNumber: String(data.get('serial') || data.get('itemCode') || 'N/A'),
      propertyNumber: String(data.get('propertyNumber') || ''),
      brand: String(data.get('brand') || ''),
      model: String(data.get('model') || ''),
      location: String(data.get('location')),
      assignedTo: String(data.get('assignedTo') || '') || undefined,
      division: String(data.get('division') || '') || undefined,
      officeOrSection: String(data.get('office') || '') || undefined,
      issuedDate: String(data.get('issuedDate') || '') || undefined,
      acquisitionDate: String(data.get('acquisitionDate') || '') || undefined,
      acquisitionCost: Number(data.get('acquisitionCost') || 0) || undefined,
      supplier: String(data.get('supplier') || '') || undefined,
      purchaseOrderNumber: String(data.get('purchaseOrder') || '') || undefined,
      fundCluster: String(data.get('fundCluster') || '') || undefined,
      usefulLifeYears: Number(data.get('usefulLife') || 0) || undefined,
      warrantyStart: String(data.get('warrantyStart') || '') || undefined,
      warrantyExpiry: String(data.get('warrantyExpiry') || '') || undefined,
      nextMaintenanceDate: String(data.get('nextMaintenance') || '') || undefined,
      lotNumber: String(data.get('lotNumber') || '') || undefined,
      expirationDate: String(data.get('expirationDate') || '') || undefined,
      condition: 'Serviceable',
      status: draft ? 'Registered' : 'Available',
      acknowledgmentStatus: 'Not Required',
      stockOnHand: kind === 'supply' ? Number(data.get('quantity')) : undefined,
      reorderLevel: kind === 'supply' ? Number(data.get('reorder')) : undefined,
      unit: kind === 'supply' ? String(data.get('unit')) : undefined,
      photoUrl: photoUrl || undefined,
      photoName: photoName || undefined,
      documentNames,
      notes: String(data.get('notes') || 'New inventory record.'),
    };
    onSubmit(asset);
  }}>
    <ol className="grid grid-cols-3 gap-2" aria-label="Registration progress">{steps.map((label, index) => { const number = index + 1; const complete = step > number; const active = step === number; return <li key={label} className="min-w-0"><div className={`h-1 rounded-full ${step >= number ? 'bg-blue-600' : 'bg-slate-200'}`} /><div className="mt-2 flex items-center gap-2"><span className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-bold ${stepBadgeClass(complete, active)}`}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span><span className={`truncate text-xs font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span></div></li>; })}</ol>

    <section data-step="1" hidden={step !== 1} className="space-y-4"><div><h3 className="text-base font-bold text-slate-950">Identification</h3><p className="mt-1 text-xs text-slate-500">Core information used to identify and classify this record.</p></div><Field label={kind === 'supply' ? 'Supply name' : 'Asset name'}><input required name="name" className={inputClass} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><select required name="category" defaultValue="" className={inputClass}><option value="" disabled>Select category</option>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Type"><input required name="type" placeholder={typePlaceholderByKind[kind]} className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Brand"><input name="brand" className={inputClass} /></Field><Field label="Model"><input name="model" className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label={kind === 'supply' ? 'Item or SKU code' : 'Serial number'}><input required name={kind === 'supply' ? 'itemCode' : 'serial'} className={inputClass} /></Field><Field label={kind === 'supply' ? 'Stock classification' : 'Property or inventory number'}><input name="propertyNumber" placeholder={kind === 'supply' ? 'Common-use or specialized' : 'Generated if left blank'} className={inputClass} /></Field></div></section>

    <section data-step="2" hidden={step !== 2} className="space-y-5">{kind === 'supply' ? <><div><h3 className="text-base font-bold text-slate-950">Stock and procurement</h3><p className="mt-1 text-xs text-slate-500">Opening balance, reorder controls, sourcing, and storage.</p></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Opening quantity"><input required name="quantity" type="number" min="0" className={inputClass} /></Field><Field label="Reorder level"><input required name="reorder" type="number" min="0" className={inputClass} /></Field><Field label="Unit"><input required name="unit" placeholder="boxes" className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Unit cost"><input name="acquisitionCost" type="number" min="0" step="0.01" className={inputClass} /></Field><Field label="Supplier"><input name="supplier" className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Lot number"><input name="lotNumber" className={inputClass} /></Field><Field label="Expiration date"><input name="expirationDate" type="date" className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Fund cluster"><input name="fundCluster" className={inputClass} /></Field><Field label="Storage location"><input required name="location" className={inputClass} /></Field></div></> : <><div><h3 className="text-base font-bold text-slate-950">Procurement</h3><p className="mt-1 text-xs text-slate-500">Acquisition, supplier, useful-life, and warranty information.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Acquisition date"><input required name="acquisitionDate" type="date" className={inputClass} /></Field><Field label="Acquisition cost"><input required name="acquisitionCost" type="number" min="0" step="0.01" className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Supplier"><input name="supplier" className={inputClass} /></Field><Field label="Purchase order number"><input name="purchaseOrder" className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Fund cluster"><input name="fundCluster" className={inputClass} /></Field><Field label="Estimated useful life (years)"><input name="usefulLife" type="number" min="1" max="30" className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Warranty start"><input name="warrantyStart" type="date" className={inputClass} /></Field><Field label="Warranty expiration"><input name="warrantyExpiry" type="date" className={inputClass} /></Field></div><div className="border-t border-slate-200 pt-5"><h3 className="text-base font-bold text-slate-950">Accountability and location</h3></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Division"><input name="division" className={inputClass} /></Field><Field label="Office or section"><input name="office" className={inputClass} /></Field></div><Field label="Storage or assigned location"><input required name="location" className={inputClass} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Assigned employee or custodian"><input name="assignedTo" className={inputClass} /></Field><Field label="Issuance date"><input name="issuedDate" type="date" className={inputClass} /></Field></div><Field label="Next maintenance date"><input name="nextMaintenance" type="date" className={inputClass} /></Field></>}</section>

    <section data-step="3" hidden={step !== 3} className="space-y-5"><div><h3 className="text-base font-bold text-slate-950">Photos and supporting records</h3><p className="mt-1 text-xs text-slate-500">Attach visual identification and procurement or accountability evidence.</p></div><div className="grid gap-4 sm:grid-cols-[180px_1fr]"><div className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">{photoUrl ? <Image src={photoUrl} alt="Asset preview" fill unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-center text-slate-400"><div><ImagePlus className="mx-auto h-7 w-7" /><p className="mt-2 text-xs font-semibold">No asset photo</p></div></div>}</div><div><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center hover:border-blue-400 hover:bg-blue-50/40"><Upload className="h-5 w-5 text-blue-700" /><span className="mt-2 text-sm font-bold text-slate-900">Upload primary photo</span><span className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP up to 5 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
  const file = event.target.files?.[0];
  setPhotoError('');
  if (!file) {
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setPhotoError('Photo must be 5 MB or smaller.');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    setPhotoUrl(String(reader.result));
    setPhotoName(file.name);
  };
  reader.readAsDataURL(file);
}} /></label>{photoName && <p className="mt-2 truncate text-xs font-semibold text-emerald-700">{photoName}</p>}{photoError && <p className="mt-2 text-xs font-semibold text-red-600">{photoError}</p>}</div></div><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50"><span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">Supporting documents</span><span className="mt-1 block text-xs text-slate-500">Invoice, IAR, ICS, PAR, warranty, or inspection record</span></span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="sr-only" onChange={(event) => setDocumentNames(Array.from(event.target.files ?? []).map((file) => file.name))} /></label>{documentNames.length > 0 && <ul className="space-y-1 rounded-md bg-slate-50 p-3 text-xs text-slate-600">{documentNames.map((name) => <li key={name} className="truncate">{name}</li>)}</ul>}<Field label="Notes and condition remarks"><textarea name="notes" className={`${inputClass} h-24 py-2`} /></Field><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-950">Review</p><dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Record</dt><dd className="mt-1 font-semibold text-slate-900">{review.name || '-'}</dd></div><div><dt className="text-slate-500">Category</dt><dd className="mt-1 font-semibold text-slate-900">{review.category || '-'}</dd></div><div><dt className="text-slate-500">Identifier</dt><dd className="mt-1 font-semibold text-slate-900">{review.serial || review.itemCode || '-'}</dd></div><div><dt className="text-slate-500">Location</dt><dd className="mt-1 font-semibold text-slate-900">{review.location || '-'}</dd></div></dl></div><label className="flex items-start gap-3 text-sm text-slate-700"><input required type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-700" /><span>I confirm that the identification, procurement, and accountability information is accurate.</span></label></section>

    <footer className="sticky -bottom-5 -mx-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div>{step > 1 && <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" />Previous</button>}</div><div className="flex flex-col-reverse gap-2 sm:flex-row">{step === 3 && <button type="submit" name="action" value="draft" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Save className="h-4 w-4" />Save as draft</button>}{step < 3 ? <button type="button" onClick={nextStep} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800">Continue<ChevronRight className="h-4 w-4" /></button> : <button type="submit" name="action" value="register" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800">Register record<Check className="h-4 w-4" /></button>}</div></footer>
  </form>;
}
