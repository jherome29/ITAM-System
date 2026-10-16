import { describe, expect, it } from 'vitest';
import { humanize } from './text';

// Values like "under_repair" were made readable with the CSS `capitalize` class,
// which upper-cases the first letter of EVERY word - including inside people's
// names, so "Juan dela Cruz" was displayed as "Juan Dela Cruz". Only the label
// is reworded now; data is shown as it is stored.
describe('humanize', () => {
  it('turns a stored value into a sentence-case label', () => {
    expect(humanize('under_repair')).toBe('Under repair');
    expect(humanize('flagged_for_disposal')).toBe('Flagged for disposal');
    expect(humanize('serviceable')).toBe('Serviceable');
  });

  it('copes with nothing', () => {
    expect(humanize('')).toBe('');
    expect(humanize(null)).toBe('');
    expect(humanize(undefined)).toBe('');
  });
});
