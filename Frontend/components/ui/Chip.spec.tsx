import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusChip } from '@/components/admin/AdminUi';
import { Chip } from './Chip';
import { StatusBadge } from './StatusBadge';

// Eleven small labels ("3 pending", "Not in inventory", an SLA countdown, a form code)
// were each hand-built as a rounded pill with their own padding, weight and ring. One
// Chip draws them all, and a status badge is a Chip.

describe('Chip', () => {
  it('is a small rounded label with a ring, 14px', () => {
    const html = renderToStaticMarkup(<Chip>3 pending</Chip>);

    expect(html).toContain('rounded-full');
    expect(html).toContain('ring-1');
    expect(html).toContain('text-xs');
    expect(html).toContain('>3 pending<');
  });

  it('takes its colours from the shared tones', () => {
    expect(renderToStaticMarkup(<Chip tone="amber">x</Chip>)).toContain('bg-amber-50');
    expect(renderToStaticMarkup(<Chip tone="green">x</Chip>)).toContain('bg-emerald-50');
    expect(renderToStaticMarkup(<Chip tone="red">x</Chip>)).toContain('bg-red-50');
    expect(renderToStaticMarkup(<Chip>x</Chip>)).toContain('bg-slate-100');
  });

  it('can carry an icon before its text', () => {
    const html = renderToStaticMarkup(<Chip tone="amber" icon={<svg data-testid="warn" />}>Not in inventory</Chip>);

    expect(html.indexOf('data-testid="warn"')).toBeLessThan(html.indexOf('Not in inventory'));
  });

  it('can be set in capitals, for a code', () => {
    expect(renderToStaticMarkup(<Chip className="uppercase">par</Chip>)).toContain('uppercase');
  });

  it('never wraps its text', () => {
    expect(renderToStaticMarkup(<Chip>x</Chip>)).toContain('whitespace-nowrap');
  });
});

describe('the badges built on it', () => {
  it('StatusBadge and StatusChip draw the same pill, in the same colours', () => {
    const pill = 'rounded-full px-2.5 py-1 text-xs font-semibold ring-1';

    const badge = renderToStaticMarkup(<StatusBadge status="available" />);
    const chip = renderToStaticMarkup(<StatusChip status="Available" tone="green" />);

    expect(badge).toContain(pill);
    expect(chip).toContain(pill);
    expect(badge).toContain('bg-emerald-50');
    expect(chip).toContain('bg-emerald-50');
  });
});
