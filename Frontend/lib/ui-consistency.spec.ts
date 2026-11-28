import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The screens used to be built one at a time: eight ways to print a date, six page
// titles, four input styles, a calendar styled four ways. Each rule below fails the
// build when a screen reintroduces one of those. A rule lands in the same change as the
// migration that made the code obey it, so none of them is ever red on main.

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['components', 'app', 'lib'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' || name === '.next' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [full] : [];
  });
}

const FILES = SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d))).map((file) => ({
  rel: path.relative(ROOT, file).replaceAll('\\', '/'),
  text: readFileSync(file, 'utf8'),
}));

const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

/** Files that break `pattern`, as `path:line` so a failure says where to look. Prose in a comment is not code. */
function offenders(pattern: RegExp, allowed: readonly string[] = []): string[] {
  return FILES.filter((f) => !allowed.includes(f.rel)).flatMap((f) =>
    f.text
      .split('\n')
      .flatMap((line, i) => (!COMMENT_LINE.test(line) && pattern.test(line) ? [`${f.rel}:${i + 1}`] : [])),
  );
}

// A rule that can never match passes forever. These keep the rules honest: each pattern
// must catch a sample of the thing it forbids.
describe('the rules themselves', () => {
  it('catch what they forbid', () => {
    expect('x.toLocaleString()').toMatch(/toLocale(Date|Time)?String\(\s*\)/);
    expect('text-[11px] font-bold').toMatch(/\btext-\[[\d.]+px\]/);
    expect('text-slate-400').toMatch(/\btext-(slate|gray)-[34]00\b/);
    expect('text-gray-300 ').toMatch(/\btext-(slate|gray)-[34]00\b/);
    expect('rows.slice((page - 1) * pageSize, page * pageSize)').toMatch(/\.slice\(\(page - 1\)/);
    expect('<button>Previous</button>').toMatch(/>\s*Previous\s*</);
    expect('class="block line-clamp-3"').toMatch(/\b(block|flex|grid|inline-block|inline-flex)\b[^"`]*line-clamp-\d/);
    expect('class="line-clamp-2 flex"').toMatch(/line-clamp-\d[^"`]*\b(block|flex|grid|inline-block|inline-flex)\b/);
  });
});

describe('dates and numbers', () => {
  it('never format with the viewer\'s own locale', () => {
    // 10/16/2026 on one machine, 16/10/2026 on the next: ambiguous in an audit trail.
    expect(offenders(/toLocale(Date|Time)?String\(\s*\)/)).toEqual([]);
  });

  it('print dates only through lib/dates, not with Intl options of their own', () => {
    expect(offenders(/toLocale(Date|Time)String\(/, ['lib/dates.ts'])).toEqual([]);
    expect(offenders(/toLocaleString\([^)]*\b(year|month|day|hour|minute)\b/, ['lib/dates.ts'])).toEqual([]);
    expect(offenders(/Intl\.DateTimeFormat/, ['lib/dates.ts'])).toEqual([]);
  });
});

const IN_KIT = FILES.filter((f) => f.rel.startsWith('components/ui/')).map((f) => f.rel);

describe('the palette', () => {
  it('uses one neutral grey (slate), not slate and gray both', () => {
    expect(offenders(/-gray-\d{2,3}\b/)).toEqual([]);
  });

  it('names brand colours (text-brand, bg-canvas, bg-navy), never a hex value in a class', () => {
    expect(offenders(/-\[#[0-9a-fA-F]{3,8}\]/)).toEqual([]);
  });
});

describe('form controls', () => {
  it('draw a date box only through DateField', () => {
    expect(offenders(/\btype="date"/, ['components/ui/DateField.tsx'])).toEqual([]);
  });

  it('take their styling from components/ui/controls, not a per-screen class', () => {
    expect(offenders(/\bconst (input|select|textarea|field)Class\s*=/, IN_KIT)).toEqual([]);
    // The border and focus ring of a control are written once, in the kit.
    expect(offenders(/focus:ring-2 focus:ring-(blue-100|brand)/, IN_KIT)).toEqual([]);
  });

  it('are not rebuilt as a one-off filter row', () => {
    expect(offenders(/min-w-(44|48|56) rounded-md border border-slate-(200|300)/, IN_KIT)).toEqual([]);
  });
});

describe('page headers', () => {
  it('have one level-one heading component, PageHeader (the sign-in page has its own)', () => {
    expect(offenders(/<h1\b/, ['components/ui/PageHeader.tsx', 'app/(auth)/login/page.tsx'])).toEqual([]);
  });

  it('use PageHeader\'s eyebrow, not a hand-rolled one', () => {
    expect(offenders(/text-xs font-bold uppercase tracking-(widest|wide|\[0\.14em\]) text-blue-700/, ['components/ui/PageHeader.tsx'])).toEqual([]);
  });
});

describe('buttons and badges', () => {
  it('colour every primary button from buttonClass, in one blue', () => {
    expect(offenders(/\bbg-blue-700\b.*\btext-white\b.*\bhover:bg-blue-800\b/, ['components/ui/buttons.ts'])).toEqual([]);
  });

  it('show a status through one StatusBadge', () => {
    expect(FILES.some((f) => f.rel === 'components/dashboard/StatusBadge.tsx')).toBe(false);
  });
});

describe('cards, labels and messages', () => {
  it('show an error through Notice, so it is announced and looks the same everywhere', () => {
    expect(offenders(/border-red-200 bg-red-50/, ['components/ui/Notice.tsx'])).toEqual([]);
  });

  it('draw a small label through Chip, not a hand-built pill', () => {
    expect(offenders(/rounded-full[^"`]*\bpx-2(\.5)?\b/, ['components/ui/Chip.tsx'])).toEqual([]);
  });

  it('say a table is empty through EmptyRow', () => {
    expect(offenders(/<td colSpan=\{\d+\} className="[^"]*text-center/, ['components/ui/EmptyRow.tsx'])).toEqual([]);
  });

  it('open a dialog or drawer only through the shared components', () => {
    const overlays = ['components/ui/CenteredModal.tsx', 'components/ui/ConfirmDialog.tsx', 'components/ui/DetailDrawer.tsx', 'components/shell/AppShell.tsx'];
    expect(offenders(/\bfixed inset-0\b/, overlays)).toEqual([]);
  });

  it('use one corner and one shadow for a card', () => {
    expect(offenders(/\brounded-(xl|2xl|3xl)\b/)).toEqual([]);
    expect(offenders(/\bshadow-\[/)).toEqual([]);
  });

  it('draw a metric card only through MetricCard', () => {
    expect(offenders(/\bfunction (KpiTile|SummaryMetric|DashboardPanel)\b/)).toEqual([]);
  });
});

describe('layout', () => {
  // A 90-character serial number, an unbroken URL or a name with no spaces used to stretch
  // a table (by up to 1,446px) or a card past the page and be cut off. A long word now
  // breaks anywhere it has to, in every table, card and drawer.
  it('lets a long unbroken word wrap instead of widening its box', () => {
    const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
    expect(css).toMatch(/body\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  // With overflow-wrap: anywhere a column can shrink to one letter, so a header read
  // "R-E-Q-U-E-S-T-E-D B-Y" down the page beside a long description. A header word never breaks;
  // that also gives every column a floor as wide as its longest header word.
  it('keeps a table header word whole, so no column can collapse to a letter', () => {
    const adminUi = FILES.find((f) => f.rel === 'components/admin/AdminUi.tsx')?.text ?? '';
    expect(adminUi).toMatch(/export const thClass = '[^']*\bbreak-normal\b/);
  });

  // A few hundred rows in one table stalled the browser for one to two seconds and buried the
  // page. A long list pages through lib/pagination (usePaged + Pager), with one set of buttons.
  it('pages a long list through the shared Pager, not a hand-built one', () => {
    expect(offenders(/>\s*Previous\s*</, ['components/ui/Pager.tsx'])).toEqual([]);
    expect(offenders(/\.slice\(\(page - 1\)/, ['lib/pagination.ts'])).toEqual([]);
  });

  // line-clamp works by setting display: -webkit-box. Put block, flex or grid next to it and
  // whichever Tailwind writes last wins: `block line-clamp-2` computed to display: block, so a
  // 500-character description ran 11 lines instead of 2 and the clamp did nothing at all.
  it('never pairs line-clamp with a display class that switches it off', () => {
    expect(offenders(/line-clamp-\d[^"`]*\b(block|flex|grid|inline-block|inline-flex)\b/)).toEqual([]);
    expect(offenders(/\b(block|flex|grid|inline-block|inline-flex)\b[^"`]*line-clamp-\d/)).toEqual([]);
  });

  it('sets the page width once, in the shell, so every page starts at the same place', () => {
    expect(offenders(/max-w-\[1[45]00px\]/, ['components/shell/AppShell.tsx'])).toEqual([]);
  });
});

describe('wording', () => {
  it('spells it fulfillment, as the menus do (the API route keeps its own spelling)', () => {
    expect(offenders(/\bFulfilment\b/)).toEqual([]);
    expect(offenders(/\b(left after this|awaiting) fulfilment\b/)).toEqual([]);
  });

  it('says "Could not …", not "Failed to …" or "Unable to …", when something goes wrong', () => {
    expect(offenders(/['"`>]Failed to /)).toEqual([]);
  });

  it('ends a progress message with one ellipsis character, not three dots', () => {
    expect(offenders(/[A-Za-z]\.\.\.['"<`]/)).toEqual([]);
  });
});

// CICC's staff include older employees, and the client asked for bigger text after the
// last demo. The sizes live in one place (app/globals.css) so they can be raised or
// lowered for the whole system at once; nothing is allowed to sidestep them.
describe('type scale', () => {
  const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  const sizePx = (token: string): number => {
    const prefix = `--text-${token}:`;
    const line = css.split('\n').find((l) => l.trim().startsWith(prefix));
    return line ? Number.parseFloat(line.trim().slice(prefix.length)) * 16 : 0;
  };

  it('keeps the smallest text at 14px and body text at 16px or more', () => {
    expect(sizePx('xs')).toBeGreaterThanOrEqual(14);
    expect(sizePx('sm')).toBeGreaterThanOrEqual(16);
  });

  it('grows every step with the one below it', () => {
    const steps = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'].map(sizePx);
    expect(steps.every((px, i) => px > 0 && (i === 0 || px > steps[i - 1]))).toBe(true);
  });

  it('loads one typeface', () => {
    expect(css).not.toMatch(/family=(Inter|Manrope)/);
    expect(css).not.toMatch(/font-family:\s*"?(Inter|Manrope)/);
  });

  it('uses the scale, not one-off pixel sizes', () => {
    expect(offenders(/\btext-\[[\d.]+px\]/)).toEqual([]);
  });

  it('keeps small text readable: no light-grey text on white', () => {
    expect(offenders(/\btext-(slate|gray)-[34]00\b/)).toEqual([]);
  });
});
