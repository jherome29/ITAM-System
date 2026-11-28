import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { searchControlClass, surfaceClass } from './controls';

// A filter option is either a bare string (value === label) or an explicit
// value/label pair — the latter lets callers show "IT Personnel" while
// filtering on the API's "it_personnel" slug.
export type FilterOption = string | { value: string; label: string };

export interface ToolbarFilter {
  /** Shown for the 'All' option and read out as the drop-down's name. */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: Readonly<ToolbarFilter>) {
  return (
    <label className="relative flex h-11 min-w-48 items-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
      <SlidersHorizontal className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-full w-full cursor-pointer appearance-none rounded-md bg-transparent pl-9 pr-9 outline-none"
      >
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? (option === 'All' ? label : option) : option.label;
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
    </label>
  );
}

/**
 * The one filter row: a search box, any number of drop-down filters, and room for extra
 * controls (a date range, a view switch) as children. Pass `filters` for several, or the
 * single-filter props for the common case.
 */
export function SearchToolbar({
  value,
  onChange,
  placeholder = 'Search by name, code, office, or status',
  filterLabel = 'All statuses',
  filterValue = 'All',
  filterOptions = ['All'],
  onFilterChange,
  filters,
  bare = false,
  children,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: FilterOption[];
  onFilterChange?: (value: string) => void;
  filters?: ToolbarFilter[];
  /** No card of its own: for a toolbar that already sits inside one. */
  bare?: boolean;
  children?: ReactNode;
}>) {
  const selects: ToolbarFilter[] = filters ?? [
    { label: filterLabel, value: filterValue, options: filterOptions, onChange: (next) => onFilterChange?.(next) },
  ];

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${bare ? '' : `p-3 ${surfaceClass}`}`}>
      <label className="relative min-w-0 flex-1 sm:min-w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={searchControlClass}
        />
      </label>
      {selects.map((filter) => <FilterSelect key={filter.label} {...filter} />)}
      {children}
    </div>
  );
}
