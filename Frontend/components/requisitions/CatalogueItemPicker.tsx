'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Package, Search } from 'lucide-react';
import { assetsApi, type CatalogueItem } from '@/lib/api/assets';
import { formatAvailability } from '@/lib/requisitions/catalogue-items';

// Own class strings rather than overriding AdminUi's inputClass — stacking
// h-8 over h-10 / pl-9 over px-3 depends on generated-CSS order.
const fieldBase = 'rounded-md border border-slate-200 bg-white text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const searchClass = `${fieldBase} h-10 w-full pl-9 pr-3 text-sm`;
const classSelectClass = `${fieldBase} h-8 px-2 text-xs`;

const TYPE_TABS = ['All', 'ICT', 'Fixed', 'Supplies'] as const;
const CLASS_OPTIONS = ['All', 'PPE', 'SEP', 'IES'] as const;
const SEARCH_DEBOUNCE_MS = 250;
const RESULT_LIMIT = 50;

export function catalogueItemKey(item: CatalogueItem): string {
  return [item.itemDescription, item.brand ?? '', item.assetType, item.assetClass].join('|');
}

/**
 * Searchable, filterable list of what CICC inventory actually holds right now
 * (GET /v1/assets/catalogue/items). Search and filters run server-side, so it
 * stays correct at full inventory scale rather than filtering one page.
 */
export function CatalogueItemPicker({
  selected,
  onSelect,
}: Readonly<{ selected: CatalogueItem | null; onSelect: (item: CatalogueItem | null) => void }>) {
  const [assetType, setAssetType] = useState<(typeof TYPE_TABS)[number]>('All');
  const [assetClass, setAssetClass] = useState<(typeof CLASS_OPTIONS)[number]>('All');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selected) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      assetsApi
        .catalogueItems({
          search: search.trim() || undefined,
          assetType: assetType === 'All' ? undefined : assetType,
          assetClass: assetClass === 'All' ? undefined : assetClass,
          limit: RESULT_LIMIT,
        })
        .then((res) => {
          if (cancelled) return;
          setItems(res.data);
          setError('');
        })
        .catch(() => !cancelled && setError('Could not load inventory. Please try again.'))
        .finally(() => !cancelled && setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, assetType, assetClass, selected]);

  if (selected) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-950">{selected.itemDescription}</p>
              <ItemMeta item={selected} />
            </div>
          </div>
          <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-xs font-bold text-blue-700 hover:underline">
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Asset type" className="flex rounded-md border border-slate-200 p-0.5">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={assetType === tab}
              onClick={() => setAssetType(tab)}
              className={`rounded px-3 py-1 text-xs font-bold transition-colors ${assetType === tab ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <select aria-label="Asset class" value={assetClass} onChange={(e) => setAssetClass(e.target.value as (typeof CLASS_OPTIONS)[number])} className={classSelectClass}>
          {CLASS_OPTIONS.map((c) => (
            <option key={c} value={c}>{c === 'All' ? 'All classes' : c}</option>
          ))}
        </select>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by item, brand, or item code…"
          aria-label="Search inventory"
          className={searchClass}
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border border-slate-100" aria-live="polite">
        {resultsStatus(loading, error, items.length) ?? (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={catalogueItemKey(item)}>
                <button type="button" onClick={() => onSelect(item)} className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none">
                  <div className="flex min-w-0 items-start gap-2">
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.itemDescription}</p>
                      <ItemMeta item={item} />
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{formatAvailability(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {items.length >= RESULT_LIMIT && !loading && (
        <p className="text-xs text-slate-500">Showing the first {RESULT_LIMIT} matches — refine your search to narrow the list.</p>
      )}
    </div>
  );
}

/** Placeholder line for the results box, or null when there are results to list. */
function resultsStatus(loading: boolean, error: string, count: number) {
  if (loading) return <p className="p-4 text-center text-xs text-slate-500">Loading inventory…</p>;
  if (error) return <p className="p-4 text-center text-xs text-red-600">{error}</p>;
  if (count === 0) return <p className="p-4 text-center text-xs text-slate-500">No available items match. Try another search or type.</p>;
  return null;
}

function ItemMeta({ item }: Readonly<{ item: CatalogueItem }>) {
  const identity = [item.brand, item.itemCode].filter(Boolean).join(' · ');
  return (
    <div className="mt-0.5 space-y-0.5 text-xs text-slate-500">
      <p>
        <span className="font-semibold text-slate-700">{item.assetType} · {item.assetClass}</span>
        {identity && <> · {identity}</>}
        {item.conditions.length > 0 && <> · {item.conditions.join(', ').replaceAll('_', ' ')}</>}
      </p>
      {item.locations.length > 0 && (
        <p className="flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{item.locations.join(' · ')}</p>
      )}
    </div>
  );
}
