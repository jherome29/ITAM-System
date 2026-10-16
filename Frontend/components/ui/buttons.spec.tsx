import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrimaryButton, SecondaryButton } from '@/components/admin/AdminUi';
import { buttonClass } from './buttons';

// Primary buttons came in two blues (Tailwind blue-700 and a hard-coded hex) at 36, 40
// and 48px, bold in some places and semibold in others. Links that look like buttons
// were styled by hand. One function now describes all of them.

describe('buttonClass', () => {
  it('defaults to a primary button 44px tall, matching a form control beside it', () => {
    const cls = buttonClass();

    expect(cls).toContain('bg-blue-700');
    expect(cls).toContain('h-11');
    expect(cls).toContain('text-sm');
  });

  it('has a quieter secondary button with a visible border', () => {
    const cls = buttonClass({ variant: 'secondary' });

    expect(cls).toContain('border-slate-300');
    expect(cls).toContain('bg-white');
    expect(cls).not.toContain('bg-blue-700');
  });

  it('has a red danger button for destructive actions', () => {
    expect(buttonClass({ variant: 'danger' })).toContain('bg-red-700');
  });

  it('has a green success look for a done state, such as "Requested"', () => {
    expect(buttonClass({ variant: 'success' })).toContain('bg-emerald-600');
  });

  it('has a compact size for buttons inside table rows', () => {
    const cls = buttonClass({ size: 'sm' });

    expect(cls).toContain('h-9');
    expect(cls).not.toContain('h-11');
  });

  it('shows a focus ring for keyboard users and a dimmed look when disabled', () => {
    const cls = buttonClass();

    expect(cls).toContain('focus-visible:outline-2');
    expect(cls).toContain('disabled:cursor-not-allowed');
  });

  it('never uses a hard-coded colour', () => {
    for (const variant of ['primary', 'secondary', 'danger'] as const) {
      expect(buttonClass({ variant })).not.toContain('[#');
    }
  });
});

describe('PrimaryButton and SecondaryButton', () => {
  it('are built on buttonClass', () => {
    expect(renderToStaticMarkup(<PrimaryButton>Save</PrimaryButton>)).toContain(buttonClass());
    expect(renderToStaticMarkup(<SecondaryButton>Cancel</SecondaryButton>)).toContain(buttonClass({ variant: 'secondary' }));
  });

  it('submit a form when asked to, and stay inert when disabled', () => {
    const html = renderToStaticMarkup(<PrimaryButton type="submit" disabled>Save</PrimaryButton>);

    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled');
  });
});
