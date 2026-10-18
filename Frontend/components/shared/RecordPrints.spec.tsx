import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintList, PrintPromptDialog, RecordPrints } from './RecordPrints';

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

// The paper says "check this paper against the system with the print number and code", so the list has to show both.
describe('PrintList', () => {
  const prints = [
    { id: 'f-1', documentNumber: 'PR-2026-0001', verificationCode: 'K7Q2-9DXM', generatedAt: '2026-10-18T07:41:00Z', copy: 1, printedByName: 'Juan dela Cruz' },
    { id: 'f-2', documentNumber: 'PR-2026-0002', verificationCode: null, generatedAt: '2026-10-18T08:00:00Z', copy: 2, printedByName: 'Maria Santos' },
  ];

  it('shows each copy with its number, verification code and who printed it, newest first', () => {
    const html = renderToStaticMarkup(<PrintList prints={prints} onOpen={() => undefined} />);

    expect(html).toContain('Printed 2 times');
    expect(html).toContain('PR-2026-0001');
    expect(html).toContain('K7Q2-9DXM');
    expect(html).toContain('Juan dela Cruz');
    expect(html.indexOf('PR-2026-0002')).toBeLessThan(html.indexOf('PR-2026-0001'));
  });

  it('says nothing about a code a copy does not have', () => {
    const html = renderToStaticMarkup(<PrintList prints={[prints[1]]} onOpen={() => undefined} />);

    expect(html).toContain('Printed 1 time');
    expect(html).not.toContain('Code');
  });

  it('draws nothing when there are no copies yet', () => {
    expect(renderToStaticMarkup(<PrintList prints={[]} onOpen={() => undefined} />)).toBe('');
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
