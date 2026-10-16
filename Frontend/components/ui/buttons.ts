// One look for every button, and for links that look like buttons. 44px tall (the same
// as a form control beside it) with 16px text; `sm` is for the buttons inside table rows.

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed';

const SIZE = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
} as const;

const VARIANT = {
  primary:
    'bg-blue-700 text-white shadow-sm hover:bg-blue-800 focus-visible:outline-blue-700 disabled:bg-slate-300',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-blue-700 disabled:bg-slate-50 disabled:text-slate-500',
  danger:
    'bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:outline-red-700 disabled:bg-slate-300',
  success:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-emerald-600 disabled:bg-emerald-600',
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

export function buttonClass({ variant = 'primary', size = 'md' }: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  return `${BASE} ${SIZE[size]} ${VARIANT[variant]}`;
}
