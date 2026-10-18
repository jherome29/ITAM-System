import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintPromptDialog, RecordPrints } from './RecordPrints';

// The Print copy button on a record, and the "Keep a paper copy?" question right after an action.

describe('RecordPrints', () => {
  it('offers a Print copy button and says what it makes', () => {
    const html = renderToStaticMarkup(<RecordPrints kind="requisition" recordId="r-1" />);

    expect(html).toContain('Print copy');
    expect(html).toContain('A numbered printout of this requisition with signature lines');
  });

  it('names the kind of record in plain words', () => {
    expect(renderToStaticMarkup(<RecordPrints kind="asset_request" recordId="a-1" />)).toContain('of this request');
    expect(renderToStaticMarkup(<RecordPrints kind="repair" recordId="p-1" />)).toContain('of this repair');
  });

  it('is a labelled region, so a screen reader can find it', () => {
    expect(renderToStaticMarkup(<RecordPrints kind="repair" recordId="p-1" />)).toContain('aria-label="Paper copy"');
  });
});

describe('PrintPromptDialog', () => {
  it('draws nothing while there is nothing to print', () => {
    expect(renderToStaticMarkup(<PrintPromptDialog target={null} onClose={() => undefined} />)).toBe('');
  });

  it('asks whether to keep a paper copy and says which record it is', () => {
    const html = renderToStaticMarkup(
      <PrintPromptDialog target={{ kind: 'requisition', id: 'r-1', label: 'REQ-2026-0054' }} onClose={() => undefined} />,
    );

    expect(html).toContain('Keep a paper copy?');
    expect(html).toContain('REQ-2026-0054 was saved.');
    expect(html).toContain('Print copy');
    expect(html).toContain('Not now');
  });
});
