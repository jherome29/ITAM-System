import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmDialog } from './ConfirmDialog';

// A confirmation that screen readers announced as nothing: no dialog role, no
// accessible name, no way to dismiss it from the keyboard.

const markup = (open: boolean) =>
  renderToStaticMarkup(
    <ConfirmDialog open={open} title="Sign Ana Reyes out?" detail="Their password is unchanged." onConfirm={() => undefined} onCancel={() => undefined} />,
  );

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    expect(markup(false)).toBe('');
  });

  it('is a modal alert dialog named and described by its text', () => {
    const html = markup(true);

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain(`id="${describedBy}"`);
  });
});
