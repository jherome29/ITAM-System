import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CenteredModal } from './CenteredModal';

// Two dialogs (reset a password, update an asset's lifecycle) were built by hand as
// their own overlays, with their own corners and no Escape key. They use this one.

const render = (props: Partial<Parameters<typeof CenteredModal>[0]> = {}) =>
  renderToStaticMarkup(
    <CenteredModal open title="Reset password" onClose={() => undefined} {...props}>
      <p>body</p>
    </CenteredModal>,
  );

describe('CenteredModal', () => {
  it('draws nothing while closed', () => {
    expect(render({ open: false })).toBe('');
  });

  it('keeps a very long title to two lines, with the whole text on hover', () => {
    const long = 'Request forensic mobile rack calibration '.repeat(20).trim();
    const html = render({ title: long });

    expect(html).toContain('line-clamp-2');
    expect(html).toContain(`title="${long}"`);
  });

  it('is a labelled modal dialog with the title as its heading', () => {
    const html = render();

    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="centered-modal-title"');
    expect(html).toContain('>Reset password</h2>');
    expect(html).toContain('<p>body</p>');
  });

  it('shows a line of description under the title', () => {
    expect(render({ description: 'They will be signed out everywhere.' })).toContain('They will be signed out everywhere.');
  });

  it('is wide by default, for forms with many fields', () => {
    expect(render()).toContain('max-w-3xl');
  });

  it('has a narrow size for a short confirmation or a few fields', () => {
    const html = render({ size: 'sm' });

    expect(html).toContain('max-w-md');
    expect(html).not.toContain('max-w-3xl');
  });

  it('uses the same corner as every card', () => {
    const html = render();

    expect(html).toContain('rounded-lg');
    expect(html).not.toContain('rounded-2xl');
  });
});
