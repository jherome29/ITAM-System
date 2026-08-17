import { SearchInput } from './SearchInput';

export function FilterBar({
  search,
  onSearch,
  filters,
}: Readonly<{
  search: string;
  onSearch: (value: string) => void;
  filters: Array<{ label: string; value: string; options: string[]; onChange: (value: string) => void }>;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <SearchInput value={search} onChange={onSearch} />
      {filters.map((filter) => (
        <label key={filter.label} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          {filter.label}
          <select
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {filter.options.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

