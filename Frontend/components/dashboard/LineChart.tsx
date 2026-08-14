import type { TrendPoint } from '@/lib/mock/dashboard.mock';

function pointsFor(values: number[], width: number, height: number) {
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * (height - 16) - 8;
      return `${x},${y}`;
    })
    .join(' ');
}

export function LineChart({ data }: { data: TrendPoint[] }) {
  const width = 720;
  const height = 160;
  const requisitions = data.map((item) => item.requisitions);
  const issued = data.map((item) => item.issued);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible">
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="0" x2={width} y1={line * 42 + 10} y2={line * 42 + 10} stroke="#e5e7eb" strokeDasharray="4 4" />
        ))}
        <polyline points={pointsFor(requisitions, width, height)} fill="none" stroke="#2455d6" strokeWidth="3" strokeLinejoin="round" />
        <polyline points={pointsFor(issued, width, height)} fill="none" stroke="#087a55" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div className="grid grid-cols-6 text-center text-xs text-slate-500">
        {data.map((item) => <span key={item.label}>{item.label}</span>)}
      </div>
      <div className="mt-5 flex justify-center gap-5 text-xs">
        <span className="text-blue-700">Requisitions Filed</span>
        <span className="text-emerald-700">Items Issued</span>
      </div>
    </div>
  );
}

