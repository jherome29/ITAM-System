export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-11 rounded-lg bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="h-72 rounded-lg bg-slate-200" />
        <div className="h-72 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

