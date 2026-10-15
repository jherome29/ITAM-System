import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DetailDrawer } from './DetailDrawer';

// Every record drawer in the system is this component. It announced itself to
// assistive technology as nothing - no dialog role, no label - so a screen
// reader landed on an unnamed region behind a dimmed page.

const markup = (open: boolean) =>
  renderToStaticMarkup(
    <DetailDrawer open={open} title="Request AR-0012" onClose={() => undefined}>
      <p>Body</p>
    </DetailDrawer>,
  );

describe('DetailDrawer', () => {
  it('renders nothing while closed', () => {
    expect(markup(false)).toBe('');
  });

  it('is a modal dialog named by its title', () => {
    const html = markup(true);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain('Request AR-0012');
  });
});
