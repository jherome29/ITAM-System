'use client';

import { useEffect, useState } from 'react';

// Presentational, parent-controlled toast. Most call sites set `message` and
// never clear it, so the component self-dismisses after `duration`.
// `dismissedFor` records the message the timer already retired, so a fresh or
// changed message shows again while the retired one stays hidden — without the
// parent having to reset its own state.
export function Toast({
  message,
  duration = 4000,
}: Readonly<{ message: string; duration?: number }>) {
  const [dismissedFor, setDismissedFor] = useState('');

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setDismissedFor(message), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);

  if (!message || dismissedFor === message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[60] rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-2xl"
    >
      {message}
    </div>
  );
}
