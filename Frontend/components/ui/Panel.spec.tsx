import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Panel as AdminPanel } from '@/components/admin/AdminUi';
import { Chip } from './Chip';
import { Panel } from './Panel';

// A titled white card was written three ways: the admin Panel, the employee
// dashboard's own panel (tinted header, bigger shadow) and the role dashboards'
// list section. One Panel serves them all.

describe('Panel', () => {
  it('is a white card with a title as its level-two heading', () => {
    const html = renderToStaticMarkup(<Panel title="Awaiting Fulfillment"><p>body</p></Panel>);

    expect(html).toContain('<h2');
    expect(html).toContain('>Awaiting Fulfillment</h2>');
    expect(html).toContain('rounded-lg border border-slate-200 bg-white shadow-sm');
    expect(html).toContain('<p>body</p>');
  });

  it('sizes the title from the scale', () => {
    expect(renderToStaticMarkup(<Panel title="T">x</Panel>)).toContain('text-base font-bold');
  });

  it('shows a line of detail, a badge beside the title and an action at the right', () => {
    const html = renderToStaticMarkup(
      <Panel title="Needs your attention" detail="Prioritized tasks" badge={<Chip tone="amber">0 pending</Chip>} action={<a href="/x">View all</a>}>
        x
      </Panel>,
    );

    expect(html).toContain('Prioritized tasks');
    expect(html).toContain('0 pending');
    expect(html).toContain('View all');
    expect(html.indexOf('Needs your attention')).toBeLessThan(html.indexOf('0 pending'));
  });

  it('leaves out the detail line when there is none', () => {
    expect(renderToStaticMarkup(<Panel title="T">x</Panel>)).not.toContain('mt-1 text-xs');
  });

  it('is the same Panel the admin screens import', () => {
    expect(AdminPanel).toBe(Panel);
  });
});
