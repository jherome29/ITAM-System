import type { ConditionSlice } from '@/lib/mock/dashboard.mock';

export function DonutChart({ data }: { data: ConditionSlice[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const slices = data.map((item, index) => {
    const previous = data.slice(0, index).reduce((sum, slice) => sum + (slice.value / total) * 75, 0);
    return {
      ...item,
      dash: (item.value / total) * 75,
      offset: 25 - previous,
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
        {slices.map((item) => (
            <circle
              key={item.label}
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke={item.color}
              strokeWidth="18"
              strokeDasharray={`${item.dash} ${100 - item.dash}`}
              strokeDashoffset={item.offset}
            />
        ))}
      </svg>
      <div className="mt-4 w-full space-y-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
            <span className="font-bold text-slate-950">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
