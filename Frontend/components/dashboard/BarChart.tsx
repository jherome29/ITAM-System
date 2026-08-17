import type { CategoryValue } from '@/lib/mock/dashboard.mock';

export function BarChart({ data }: Readonly<{ data: CategoryValue[] }>) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex h-44 items-end gap-4">
      {data.map((item) => (
        <div key={item.label} className="flex h-full flex-1 flex-col justify-end gap-2">
          <div className="rounded-t bg-blue-700" style={{ height: `${Math.max((item.value / max) * 100, 2)}%` }} />
          <span className="h-8 text-center text-xs text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

