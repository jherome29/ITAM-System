export function ActivityTimeline({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3 text-sm">
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
          <span className="text-slate-700">{item}</span>
        </li>
      ))}
    </ol>
  );
}

