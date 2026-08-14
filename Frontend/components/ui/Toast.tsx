export function Toast({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
      {message}
    </div>
  );
}
