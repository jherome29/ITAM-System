import PDFDocument from 'pdfkit';
import { conditionLabel, phpFormat } from './base-form.generator';
import { generateRPCI } from './rpci.generator';
import { generateRSMI } from './rsmi.generator';

// RPCI and RSMI are worksheets the property office fills in and signs. They used
// to arrive pre-filled with guesses: a count of 1 for every line, a raw enum as
// the remark, "PHP 0.00" as the cost of every supply issued.

const drawnBy = async (run: () => Promise<Buffer>) => {
  const text = jest.spyOn(PDFDocument.prototype, 'text');
  await run();
  const drawn = text.mock.calls.map(([t]) => String(t));
  text.mockRestore();
  return drawn;
};

describe('conditionLabel', () => {
  it('reads like words, not like a database value', () => {
    expect(conditionLabel('serviceable')).toBe('Serviceable');
    expect(conditionLabel('for_repair')).toBe('For repair');
    expect(conditionLabel('for_disposal')).toBe('For disposal');
    expect(conditionLabel('unserviceable')).toBe('Unserviceable');
  });

  it('shows a dash when there is no condition', () => {
    expect(conditionLabel(null)).toBe('—');
    expect(conditionLabel('')).toBe('—');
  });
});

describe('RPCI count sheet', () => {
  afterEach(() => jest.restoreAllMocks());

  const supply = {
    itemDescription: 'Bond Paper A4',
    assetClass: 'IES',
    acquisitionCost: 250,
    condition: 'serviceable',
    quantity: 48,
  };
  const laptop = {
    itemDescription: 'Dell Latitude 5440',
    assetClass: 'SEP',
    acquisitionCost: 46500,
    condition: 'for_repair',
    quantity: 1,
  };

  it('shows the quantity on record per card and leaves the physical count blank', async () => {
    const drawn = await drawnBy(() => generateRPCI([supply], new Date()));

    expect(drawn).toContain('48');
    // The old sheet pre-filled "1" as the counted quantity of every line.
    expect(drawn.filter((t) => t === '1')).toHaveLength(0);
  });

  it('prints the condition as words', async () => {
    const drawn = await drawnBy(() => generateRPCI([laptop], new Date()));

    expect(drawn).toContain('For repair');
    expect(drawn).not.toContain('for_repair');
  });
});

describe('RSMI issuance report', () => {
  afterEach(() => jest.restoreAllMocks());

  const from = new Date('2026-01-01');
  const to = new Date('2026-12-31');
  const costed = {
    requestNumber: 'REQ-0031',
    itemDescription: 'Bond Paper A4',
    assetType: 'supplies',
    quantity: 3,
    acquisitionCost: 250,
    stockNumber: 'SUP-0001',
  };
  const uncosted = {
    requestNumber: 'REQ-0032',
    itemDescription: 'Ink Cartridge',
    assetType: 'supplies',
    quantity: 2,
    acquisitionCost: null,
    stockNumber: null,
  };

  it('prices an issued line at its unit cost and totals it', async () => {
    const drawn = await drawnBy(() => generateRSMI([costed], from, to));

    expect(drawn).toContain(phpFormat(250));
    expect(drawn).toContain(phpFormat(750));
    expect(drawn).toContain('TOTAL AMOUNT: ' + phpFormat(750));
  });

  it('prints the stock number of the item, not a running count', async () => {
    const drawn = await drawnBy(() =>
      generateRSMI([costed, uncosted], from, to),
    );

    expect(drawn).toContain('SUP-0001');
    expect(drawn).not.toContain('001');
    expect(drawn).not.toContain('002');
  });

  it('shows a dash, never PHP 0.00, where the cost is not on record', async () => {
    const drawn = await drawnBy(() => generateRSMI([uncosted], from, to));

    expect(drawn).not.toContain(phpFormat(0));
    expect(drawn.some((t) => /not on record/i.test(t))).toBe(true);
  });

  it('totals only the lines that have a cost', async () => {
    const drawn = await drawnBy(() =>
      generateRSMI([costed, uncosted], from, to),
    );

    expect(drawn).toContain('TOTAL AMOUNT: ' + phpFormat(750));
  });
});
