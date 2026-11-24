import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusBadge } from './StatusBadge';

// "Available" was flat green on the asset registry and green with a ring on the employee
// pages, from two different components. An unknown status fell back to a style key that
// did not exist and printed the class "undefined". One badge now serves every screen.

const render = (status: string, label?: string) => renderToStaticMarkup(<StatusBadge status={status} label={label} />);

describe('StatusBadge', () => {
  it('shows a status in words, not as the stored value', () => {
    expect(render('under_repair')).toContain('>Under Repair<');
    expect(render('flagged_for_disposal')).toContain('>For Disposal<');
    expect(render('pending_supervisor')).toContain('>Pending Approval<');
  });

  it('gives each kind of status its colour: good is green, waiting amber, bad red', () => {
    expect(render('available')).toContain('bg-emerald-50');
    expect(render('under_repair')).toContain('bg-amber-50');
    expect(render('rejected')).toContain('bg-red-50');
    expect(render('issued')).toContain('bg-blue-50');
  });

  it('colours the same status the same way whichever screen asks (asset, condition, account)', () => {
    expect(render('serviceable')).toContain('bg-emerald-50');
    expect(render('active')).toContain('bg-emerald-50');
    expect(render('unserviceable')).toContain('bg-red-50');
    expect(render('inactive')).toContain('bg-slate-100');
  });

  it('has a ring and the badge shape in every colour', () => {
    const html = render('available');

    expect(html).toContain('ring-1');
    expect(html).toContain('rounded-full');
  });

  it('lets a screen say it in its own words but keeps the colour of the real status', () => {
    const html = render('pending_supervisor', 'Awaiting approval');

    expect(html).toContain('>Awaiting approval<');
    expect(html).toContain('bg-amber-50');
  });

  it('copes with a status it has never seen: neutral grey, readable label, never "undefined"', () => {
    const html = render('on_the_moon');

    expect(html).toContain('>On the moon<');
    expect(html).toContain('bg-slate-100');
    expect(html).not.toContain('undefined');
  });
});
