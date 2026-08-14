import { TriangleAlert } from 'lucide-react';

export function ErrorState({ title = 'Unable to load data', detail = 'Try refreshing this view.' }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-red-800">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-1 text-sm text-red-700">{detail}</p>
    </div>
  );
}

