import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Boxes } from 'lucide-react';
import { MetricCard } from './MetricCard';

// The same "figure with a label" was drawn three ways: icon left on the role dashboards,
// icon right with a capitalised label on the admin pages, and a third on the employee
// dashboard. One card now serves all of them.

describe('MetricCard', () => {
  it('shows the label, the figure and the icon', () => {
    const html = renderToStaticMarkup(<MetricCard label="Total assets" value={42} tone="blue" icon={Boxes} />);

    expect(html).toContain('Total assets');
    expect(html).toContain('>42<');
    expect(html).toContain('<svg');
  });

  it('puts the figure in the page-title size, bold', () => {
    const html = renderToStaticMarkup(<MetricCard label="Available" value="39" tone="green" icon={Boxes} />);

    expect(html).toContain('text-2xl');
    expect(html).toContain('font-bold');
  });

  it('adds a line of detail under the figure when given one', () => {
    const html = renderToStaticMarkup(<MetricCard label="Due back" value={0} detail="Overdue or within 7 days" tone="amber" icon={Boxes} />);

    expect(html).toContain('Overdue or within 7 days');
  });

  it('colours the icon from the shared tones', () => {
    expect(renderToStaticMarkup(<MetricCard label="x" value={1} tone="red" icon={Boxes} />)).toContain('bg-red-50');
    expect(renderToStaticMarkup(<MetricCard label="x" value={1} tone="green" icon={Boxes} />)).toContain('bg-emerald-50');
  });

  it('is a plain card, or a link to its queue when given an address', () => {
    const plain = renderToStaticMarkup(<MetricCard label="x" value={1} tone="blue" icon={Boxes} />);
    const link = renderToStaticMarkup(<MetricCard label="x" value={1} tone="blue" icon={Boxes} href="/it-asset-custodian/assets" />);

    expect(plain).not.toContain('<a ');
    expect(link).toContain('<a ');
    expect(link).toContain('href="/it-asset-custodian/assets"');
  });

  it('is the same white card as every panel', () => {
    expect(renderToStaticMarkup(<MetricCard label="x" value={1} tone="blue" icon={Boxes} />)).toContain('rounded-lg border border-slate-200 bg-white shadow-sm');
  });
});
