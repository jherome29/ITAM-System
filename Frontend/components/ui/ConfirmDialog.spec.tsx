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

// "Cancel" next to "Cancel request" reads as the same button twice. The button
// that backs out of the dialog can be named for what it keeps.
describe('ConfirmDialog cancel label', () => {
  const render = (cancelLabel?: string) =>
    renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Cancel AR-2026-0001?"
        detail="The custodian will be told."
        confirmLabel="Cancel request"
        cancelLabel={cancelLabel}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

  it('says "Cancel" unless told otherwise', () => {
    expect(render()).toContain('>Cancel</button>');
  });

  it('shows the label it is given', () => {
    const html = render('Keep request');

    expect(html).toContain('>Keep request</button>');
    expect(html).toContain('>Cancel request</button>');
    expect(html).not.toContain('>Cancel</button>');
  });
});
