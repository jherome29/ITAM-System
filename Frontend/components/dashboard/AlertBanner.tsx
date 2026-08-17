import { CircleAlert } from 'lucide-react';

export function AlertBanner({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CircleAlert className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
      <p className="leading-5">{message}</p>
    </div>
  );
}
