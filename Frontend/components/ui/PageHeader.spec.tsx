import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminPageHeader } from '@/components/admin/AdminUi';
import { PageHeader } from './PageHeader';

// There were six page-title styles: brand-blue or near-black, 24 to 32px, with or
// without an eyebrow and a line of help. One header now serves every page.

describe('PageHeader', () => {
  it('is the page\'s one level-one heading', () => {
    const html = renderToStaticMarkup(<PageHeader title="ICT Asset Registry" />);

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('>ICT Asset Registry</h1>');
  });

  // An asset's page is titled with its description, and a 690-character one ran 24 lines down the
  // page. The whole text is in the record below; the title only has to identify it.
  it('keeps a very long title to three lines, with the whole text on hover', () => {
    const long = 'forensic mobile rack calibration '.repeat(20).trim();
    const html = renderToStaticMarkup(<PageHeader title={long} />);

    expect(html).toContain('line-clamp-3');
    expect(html).toContain(`title="${long}"`);
  });

  it('uses the page-title size from the type scale, in near-black', () => {
    const html = renderToStaticMarkup(<PageHeader title="Anything" />);

    expect(html).toContain('text-2xl');
    expect(html).toContain('font-bold');
    expect(html).toContain('text-slate-950');
    expect(html).not.toContain('[#');
  });

  it('shows the workspace eyebrow and a line of help when given them', () => {
    const html = renderToStaticMarkup(
      <PageHeader eyebrow="IT Asset Custodian" title="Maintenance & Repair" detail="Track every repair from start to finish." />,
    );

    expect(html).toContain('IT Asset Custodian');
    expect(html).toContain('uppercase');
    expect(html).toContain('Track every repair from start to finish.');
  });

  it('leaves out an eyebrow or help line that is not given, rather than an empty tag', () => {
    const html = renderToStaticMarkup(<PageHeader title="QR Lookup" />);

    expect(html).not.toContain('uppercase');
    expect(html).not.toContain('<p');
  });

  it('can carry a status badge beside the title, as on an asset\'s page', () => {
    const html = renderToStaticMarkup(<PageHeader title="Dell Latitude 5540" badge={<span>Issued</span>} />);

    expect(html).toContain('Issued');
    expect(html.indexOf('Dell Latitude 5540')).toBeLessThan(html.indexOf('Issued'));
  });

  it('can draw a line under itself, as on a dashboard', () => {
    expect(renderToStaticMarkup(<PageHeader title="Good day, Ana" divider />)).toContain('border-b');
    expect(renderToStaticMarkup(<PageHeader title="Good day, Ana" />)).not.toContain('border-b');
  });

  it('puts the action (a button) beside the title', () => {
    const html = renderToStaticMarkup(<PageHeader title="Assets" action={<button type="button">Add asset</button>} />);

    expect(html).toContain('Add asset');
  });
});

describe('AdminPageHeader', () => {
  it('is the same header, defaulting the eyebrow to the administrator', () => {
    const html = renderToStaticMarkup(<AdminPageHeader title="Users" detail="Manage accounts." />);

    expect(html).toContain('Master Administrator');
    expect(html).toContain('text-2xl');
    expect(html).toContain('Manage accounts.');
  });
});
