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

/** Files that break `pattern`, as `path:line` so a failure says where to look. */
function offenders(pattern: RegExp, allowed: readonly string[] = []): string[] {
  return FILES.filter((f) => !allowed.includes(f.rel)).flatMap((f) =>
    f.text
      .split('\n')
      .flatMap((line, i) => (pattern.test(line) ? [`${f.rel}:${i + 1}`] : [])),
  );
}

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
