'use client';

import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import type { MockAsset } from '@/lib/mock/assets.mock';

function hashText(text: string) {
  return text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function QrPreview({ value }: { value: string }) {
  const seed = hashText(value);
  const cells = Array.from({ length: 49 }, (_, index) => (seed + index * 7) % 5 !== 0);

  return (
    <div id="inventory-print-code" className="grid h-28 w-28 grid-cols-7 gap-1 rounded-md border border-slate-300 bg-white p-2">
      {cells.map((filled, index) => (
        <span key={`cell-${seed}-${index}`} className={filled ? 'rounded-sm bg-slate-950' : 'rounded-sm bg-white'} />
      ))}
    </div>
  );
}

function BarcodePreview({ value }: { value: string }) {
  const bars = useMemo(
    () => value.split('').flatMap((char, index) => [char.charCodeAt(0) % 4 + 1, (index % 3) + 1]),
    [value],
  );

  return (
    <div id="inventory-print-code" className="flex h-24 w-56 items-end gap-0.5 rounded-md border border-slate-300 bg-white p-3">
      {bars.map((width, index) => (
        <span key={`bar-${index}-${width}`} className="h-full bg-slate-950" style={{ width: `${width}px` }} />
      ))}
    </div>
  );
}

export function InventoryLabelPrinter({ assets }: { assets: MockAsset[] }) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? '');
  const [labelType, setLabelType] = useState<'qr' | 'barcode'>('qr');
  const selected = assets.find((asset) => asset.id === assetId) ?? assets[0];

  if (!selected) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #inventory-print-code,
          #inventory-print-code * {
            visibility: visible;
          }
          #inventory-print-code {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            border: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Inventory Label Printing</h2>
          <p className="mt-1 text-sm text-slate-600">Generate a frontend mock QR or barcode tag for physical inventory.</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          <Printer className="h-4 w-4" />
          Print Label
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            <span>Asset</span>
            <select
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.id} - {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            <span>Label type</span>
            <select
              value={labelType}
              onChange={(event) => setLabelType(event.target.value as 'qr' | 'barcode')}
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="qr">QR code</option>
              <option value="barcode">Barcode</option>
            </select>
          </label>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 sm:col-span-2">
            This is a printable frontend mock label. Real QR/barcode generation and print templates can be wired to backend asset records later.
          </div>
        </div>

        <div id="inventory-print-label" className="rounded-lg border border-slate-300 bg-white p-4 text-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">AIMRS Inventory Tag</p>
              <h3 className="mt-1 text-lg font-bold">{selected.name}</h3>
              <p className="text-sm font-semibold text-blue-700">{selected.id}</p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold">{selected.scope}</span>
          </div>
          <div className="mt-4 flex justify-center">
            {labelType === 'qr' ? <QrPreview value={selected.id} /> : <BarcodePreview value={selected.id} />}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="font-bold text-slate-500">Serial</dt>
              <dd>{selected.serialNumber}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Location</dt>
              <dd>{selected.location}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Status</dt>
              <dd>{selected.status}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Condition</dt>
              <dd>{selected.condition}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
