// Semantic colour for a chip, badge or status row. One palette for the whole system, so
// "good" is the same green and "needs attention" the same amber on every screen.
export type Tone = 'blue' | 'green' | 'amber' | 'orange' | 'red' | 'slate';

export const toneStyles: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  orange: 'bg-orange-50 text-orange-800 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};
