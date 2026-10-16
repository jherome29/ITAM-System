import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyMessage, EmptyRow } from './EmptyRow';
import { Notice } from './Notice';

// Twenty-six error banners were written by hand in seven recipes (some with role="alert",
// most without; three corner radii; bold or regular). A table with nothing in it was a
// hand-built row in a dozen places. One Notice and one EmptyRow replace them.

describe('Notice', () => {
  it('announces an error to a screen reader as soon as it appears', () => {
    const html = renderToStaticMarkup(<Notice tone="red">Could not load the registry.</Notice>);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not load the registry.');
    expect(html).toContain('border-red-200 bg-red-50');
  });

  it('is a polite status for anything that is not an error', () => {
    const html = renderToStaticMarkup(<Notice tone="amber">Showing the first 500 records.</Notice>);

    expect(html).toContain('role="status"');
    expect(html).toContain('border-amber-200 bg-amber-50');
  });

  it('has blue and green too, and defaults to blue', () => {
    expect(renderToStaticMarkup(<Notice>Lifecycle updated.</Notice>)).toContain('border-blue-200 bg-blue-50');
    expect(renderToStaticMarkup(<Notice tone="green">Saved.</Notice>)).toContain('border-emerald-200 bg-emerald-50');
  });

  it('is the same size and weight whatever the tone', () => {
    for (const tone of ['red', 'amber', 'blue', 'green'] as const) {
      const html = renderToStaticMarkup(<Notice tone={tone}>x</Notice>);

      expect(html).toContain('rounded-md');
      expect(html).toContain('px-4 py-3');
      expect(html).toContain('text-sm font-semibold');
    }
  });

  it('can start with an icon', () => {
    const html = renderToStaticMarkup(<Notice tone="red" icon={<svg data-testid="i" />}>Overdue</Notice>);

    expect(html.indexOf('data-testid="i"')).toBeLessThan(html.indexOf('Overdue'));
  });
});

describe('EmptyRow', () => {
  it('spans the table and says why it is empty', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <EmptyRow colSpan={6}>No requests match the current filter.</EmptyRow>
        </tbody>
      </table>,
    );

    expect(html).toContain('colSpan="6"');
    expect(html).toContain('No requests match the current filter.');
    expect(html).toContain('text-center');
  });
});

describe('EmptyMessage', () => {
  it('says why a list or panel is empty, centred, in the same type as an empty table row', () => {
    const html = renderToStaticMarkup(<EmptyMessage>Nothing is flagged for disposal.</EmptyMessage>);

    expect(html).toContain('Nothing is flagged for disposal.');
    expect(html).toContain('text-center text-sm text-slate-600');
  });
});
