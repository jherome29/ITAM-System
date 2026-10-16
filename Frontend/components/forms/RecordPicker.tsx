'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { inputClass } from '@/components/admin/AdminUi';

export interface PickerOption {
  id: string;
  title: string;
  subtitle?: string;
}

/**
 * Pick one record by searching for it, instead of pasting its UUID. The caller
 * supplies the search (server-side for assets, which number in the thousands);
 * this component owns the typing, the debounce and the result list.
 */
export function RecordPicker({
  label,
  placeholder,
  selected,
  onSelect,
  search,
  emptyText = 'Nothing matches.',
  required = false,
}: Readonly<{
  label: string;
  placeholder: string;
  selected: PickerOption | null;
  onSelect: (option: PickerOption | null) => void;
  search: (query: string) => Promise<PickerOption[]>;
  emptyText?: string;
  required?: boolean;
}>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);
  const listId = useId();
  // The newest search wins; a slow earlier one must not overwrite it.
  const latest = useRef(0);
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    if (selected || !focused) return;
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      searchRef
        .current(query.trim())
        .then((found) => {
          if (ticket === latest.current) setResults(found);
        })
        .catch(() => {
          if (ticket === latest.current) setFailed(true);
        })
        .finally(() => {
          if (ticket === latest.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected, focused]);

  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
      </span>
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{selected.title}</p>
            {selected.subtitle && <p className="truncate text-xs text-slate-600">{selected.subtitle}</p>}
          </div>
          <button type="button" onClick={() => onSelect(null)} className="grid h-7 w-7 flex-none place-items-center rounded-md text-slate-500 hover:bg-white" aria-label={`Clear ${label}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholder}
            aria-label={label}
            aria-controls={listId}
            autoComplete="off"
            className={`${inputClass} pl-9`}
          />
          {focused && (
            <ul id={listId} aria-label={`${label} results`} className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {loading && <li className="px-3 py-2 text-xs text-slate-500">Searching…</li>}
              {!loading && failed && <li className="px-3 py-2 text-xs font-semibold text-red-700">Search failed. Try again.</li>}
              {!loading && !failed && results.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">{emptyText}</li>}
              {!loading &&
                !failed &&
                results.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(option);
                        setQuery('');
                        setFocused(false);
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-blue-50"
                    >
                      <span className="block truncate text-sm font-semibold text-slate-900">{option.title}</span>
                      {option.subtitle && <span className="block truncate text-xs text-slate-500">{option.subtitle}</span>}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
