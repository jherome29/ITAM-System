import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pager } from './Pager';
import { ClampText } from './ClampText';
import { currentPage } from '@/lib/pagination';

const noop = () => undefined;

describe('Pager', () => {
  it('shows nothing for a list that fits on one page', () => {
    expect(renderToStaticMarkup(<Pager page={1} total={20} pageSize={25} onPage={noop} noun="requests" />)).toBe('');
    expect(renderToStaticMarkup(<Pager page={1} total={0} pageSize={25} onPage={noop} noun="requests" />)).toBe('');
  });

  it('says which records are showing and how many there are', () => {
    const html = renderToStaticMarkup(<Pager page={2} total={163} pageSize={25} onPage={noop} noun="requests" />);

    expect(html).toContain('Showing 26–50 of 163 requests');
    expect(html).toContain('Page 2 of 7');
  });

  it('cannot go back from the first page or on from the last', () => {
    const first = renderToStaticMarkup(<Pager page={1} total={60} pageSize={25} onPage={noop} noun="rows" />);
    const last = renderToStaticMarkup(<Pager page={3} total={60} pageSize={25} onPage={noop} noun="rows" />);

    expect(first).toMatch(/<button[^>]*\sdisabled=""[^>]*>Previous/);
    expect(first).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Next/);
    expect(last).toMatch(/<button[^>]*\sdisabled=""[^>]*>Next/);
    expect(last).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Previous/);
  });

  it('announces a change of page politely, for a screen reader', () => {
    expect(renderToStaticMarkup(<Pager page={1} total={60} pageSize={25} onPage={noop} noun="rows" />)).toContain('aria-live="polite"');
  });
});

describe('ClampText', () => {
  it('keeps a long description to a few lines, with the whole text on hover', () => {
    const long = 'forensic workstation '.repeat(40).trim();
    const html = renderToStaticMarkup(<ClampText>{long}</ClampText>);

    expect(html).toContain('line-clamp-3');
    expect(html).toContain(`title="${long}"`);
  });

  // `block line-clamp-3` computed to display: block, which switches the clamp off: a 500-character
  // description ran 11 lines. The clamp must be the only thing deciding the display.
  it('leaves display to the clamp, so it clamps', () => {
    const html = renderToStaticMarkup(<ClampText>x</ClampText>);

    expect(html).not.toMatch(/class="[^"]*\b(block|flex|grid|inline-block|inline-flex)\b/);
  });

  // Without a ceiling, a 500-character description is the widest thing in its table, takes the
  // width, and squeezes the other columns down to a letter each.
  it('stops one long cell taking the width of its table', () => {
    expect(renderToStaticMarkup(<ClampText>x</ClampText>)).toMatch(/class="[^"]*\bmax-w-\w+/);
  });

  it('takes the number of lines', () => {
    expect(renderToStaticMarkup(<ClampText lines={2}>x</ClampText>)).toContain('line-clamp-2');
  });

  it('shows a dash for nothing', () => {
    expect(renderToStaticMarkup(<ClampText>{null}</ClampText>)).toContain('—');
  });
});

describe('currentPage', () => {
  // A list that is on page 5 of a search, then searched again, starts again at page 1.
  it('keeps the page while the filters are the same', () => {
    expect(currentPage({ page: 5, key: 'a|b' }, 'a|b')).toBe(5);
  });

  it('goes back to page 1 when the filters change', () => {
    expect(currentPage({ page: 5, key: 'a|b' }, 'a|c')).toBe(1);
  });
});
