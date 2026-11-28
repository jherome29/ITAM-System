import { describe, expect, it } from 'vitest';
import { tdClass, tdNoWrapClass, thClass } from '@/components/admin/AdminUi';
import { buttonClass } from './buttons';

// With the bigger text, 16 tables were wider than their panel at a 1440px screen (up to
// 450px wider), so the Actions column and its buttons sat off the right edge behind a
// sideways scroll. The cause was a no-wrap default on every cell and header, and a
// button label that wrapped inside a fixed-height button.

describe('table cells', () => {
  it('may wrap, so a table fits its panel instead of running past it', () => {
    expect(tdClass).not.toContain('whitespace-nowrap');
  });

  it('may wrap in the header row too', () => {
    expect(thClass).not.toContain('whitespace-nowrap');
  });

  it('keep the same padding, border and type either way', () => {
    expect(tdClass).toContain('px-4 py-3');
    expect(tdClass).toContain('border-t border-slate-100');
    expect(tdNoWrapClass).toContain('px-4 py-3');
    expect(tdNoWrapClass).toContain('border-t border-slate-100');
  });

  it('can still stay on one line when a column must (a time, a count)', () => {
    expect(tdNoWrapClass).toContain('whitespace-nowrap');
  });
});

describe('button labels', () => {
  it('never wrap onto a second line inside a fixed-height button', () => {
    for (const variant of ['primary', 'secondary', 'danger', 'success'] as const) {
      for (const size of ['md', 'sm'] as const) {
        expect(buttonClass({ variant, size })).toContain('whitespace-nowrap');
      }
    }
  });
});
