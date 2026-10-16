// One look for every form control in the system: text and number inputs, selects,
// text areas, search boxes and date boxes. 44px tall so 16px text and a thumb both fit
// (the client asked for bigger text). Do not write a per-screen input class; import these.

const LOOK =
  'rounded-md border border-slate-300 bg-white text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

/** Height and look, no width: for a control that sets its own (a date box in a filter row). */
export const controlBaseClass = `h-11 px-3 ${LOOK}`;

/** The standard single-line control, full width of its column. */
export const controlClass = `${controlBaseClass} w-full`;

/** A control with a button inside its right edge (the show-password eye). */
export const controlWithTrailingIconClass = `h-11 w-full pl-3 pr-11 ${LOOK}`;

/** A search box with room on the left for the magnifier icon. */
export const searchControlClass = `h-11 w-full pl-9 pr-3 ${LOOK}`;

/** A multi-line control: taller than one line, same border and focus ring. */
export const textareaClass = `min-h-24 w-full px-3 py-2 ${LOOK}`;

/** The text above a control. */
export const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

/** A white card with a hairline border: panels, filter rows, summary cards. */
export const surfaceClass = 'rounded-lg border border-slate-200 bg-white shadow-sm';
