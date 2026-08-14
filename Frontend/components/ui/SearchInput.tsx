import { Search } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder = 'Search records' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="relative block min-w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

