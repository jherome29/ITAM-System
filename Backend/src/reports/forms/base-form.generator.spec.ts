import PDFDocument from 'pdfkit';
import {
  CONTENT_WIDTH,
  PAGE,
  bufferize,
  createDoc,
  drawFormTitle,
  drawMetaFields,
  drawSignatureBlock,
  drawTable,
  fitColumnWidths,
  formIdentity,
  documentNumber,
  identityFields,
  roleDisplay,
  withFormIdentity,
} from './base-form.generator';
import { generatePAR } from './par.generator';
import { generateICS } from './ics.generator';
import { generatePTR } from './ptr.generator';
import { generateIAR } from './iar.generator';
import { generateReceiptReturnedSEP } from './receipt-returned-sep.generator';
import { generateReceiptReturnedProperty } from './receipt-returned-property.generator';
import { generateRLSSDDP } from './rlsddp.generator';
import { generateMoveOut } from './move-out.generator';
import { generateRPCI } from './rpci.generator';
import { FORM_ENTITY_NAME } from '../../../../packages/shared/src/constants';
import { UserRole } from '../../../../packages/shared/src/enums';

// Official forms list every asset, so their tables run past one page. The table
// used to keep drawing below the page margin, and pdfkit answered by starting a
// new page for each cell: 55 assets came out as 211 pages with one word on
// each. Count and inspect the output directly - the page tree is not compressed.

const COLS = [
  { header: 'QTY', width: 40 },
  { header: 'DESCRIPTION', width: 200 },
];
const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => [String(i + 1), `row-${i + 1}`]);

/** Records every text the document is asked to draw, with its position. */
function spyOnText(doc: PDFKit.PDFDocument) {
  const drawn: Array<{ text: string; y: number | undefined }> = [];
  const original = doc.text.bind(doc);
  jest.spyOn(doc, 'text').mockImplementation(((
    text: string,
    x?: number | string,
    y?: number | string,
    options?: PDFKit.Mixins.TextOptions,
  ) => {
    drawn.push({
      text: String(text),
      y: typeof y === 'number' ? y : undefined,
    });
    return original(text, x as number, y as number, options);
  }) as unknown as typeof doc.text);
  return drawn;
}

const pageCountOf = (pdf: Buffer) =>
  (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;

describe('drawTable pagination', () => {
  it('keeps a short table on one page', () => {
    const doc = createDoc();
    drawTable(doc, COLS, rows(10), 200);

    expect(doc.bufferedPageRange().count).toBe(1);
  });

  it('flows a long table onto further pages instead of one cell per page', () => {
    const doc = createDoc();
    drawTable(doc, COLS, rows(150), 200);

    const pages = doc.bufferedPageRange().count;
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(pages).toBeLessThanOrEqual(6);
  });

  it('never draws below the page margin and loses no row', () => {
    const doc = createDoc();
    const drawn = spyOnText(doc);
    drawTable(doc, COLS, rows(150), 200);

    const lowest = PAGE.height - PAGE.margin;
    expect(drawn.every((d) => d.y === undefined || d.y <= lowest)).toBe(true);
    const cells = drawn.map((d) => d.text);
    for (let i = 1; i <= 150; i++) expect(cells).toContain(`row-${i}`);
  });

  it('repeats the column header at the top of every page', () => {
    const doc = createDoc();
    const drawn = spyOnText(doc);
    drawTable(doc, COLS, rows(150), 200);

    const headers = drawn.filter((d) => d.text === 'DESCRIPTION').length;
    expect(headers).toBe(doc.bufferedPageRange().count);
  });

  it('starts a table that has no room for a single row on a fresh page', () => {
    const doc = createDoc();
    drawTable(doc, COLS, rows(3), PAGE.height - PAGE.margin - 10);

    expect(doc.bufferedPageRange().count).toBe(2);
  });

  it('returns the position after the last row on the last page', () => {
    const doc = createDoc();
    const y = drawTable(doc, COLS, rows(150), 200);

    expect(y).toBeGreaterThan(PAGE.margin);
    expect(y).toBeLessThan(PAGE.height - PAGE.margin);
  });
});

describe('drawSignatureBlock', () => {
  const signatories = [
    { label: 'Counted by', name: '________', role: 'Officer' },
    { label: 'Verified by', name: '________', role: 'Officer' },
  ];

  it('moves to a new page when the block does not fit under the table', () => {
    const doc = createDoc();
    const end = drawSignatureBlock(
      doc,
      signatories,
      PAGE.height - PAGE.margin - 20,
    );

    expect(doc.bufferedPageRange().count).toBe(2);
    expect(end).toBeLessThan(PAGE.height / 2);
  });

  it('stays on the page when there is room', () => {
    const doc = createDoc();
    drawSignatureBlock(doc, signatories, 300);

    expect(doc.bufferedPageRange().count).toBe(1);
  });
});

describe('page numbers', () => {
  it('numbers every page of a multi-page form "Page n of N"', async () => {
    const doc = createDoc();
    const drawn = spyOnText(doc);
    drawTable(doc, COLS, rows(150), 200);
    const pages = doc.bufferedPageRange().count;

    await bufferize(doc);

    const labels = drawn
      .map((d) => d.text)
      .filter((t) => /^Page \d+ of \d+$/.test(t));
    expect(labels).toEqual(
      Array.from({ length: pages }, (_, i) => `Page ${i + 1} of ${pages}`),
    );
  });

  it('leaves a one-page form without a page number', async () => {
    const doc = createDoc();
    const drawn = spyOnText(doc);
    drawTable(doc, COLS, rows(5), 200);

    await bufferize(doc);

    expect(drawn.some((d) => /^Page \d+ of \d+$/.test(d.text))).toBe(false);
  });
});

// Every form used to print "Fund Cluster: General Fund" and the entity name as
// fixed text. The cluster was an assumption nobody at CICC had made; both now
// come from the system settings, per request.
describe('form identity', () => {
  const settings = {
    entityName: 'CICC CENTRAL OFFICE',
    fundCluster: '01 Regular Agency Fund',
  };

  afterEach(() => jest.restoreAllMocks());

  it('defaults to the CICC name and a fill-in line for the fund cluster', () => {
    expect(identityFields()).toEqual([
      { label: 'Entity Name', value: FORM_ENTITY_NAME },
      { label: 'Fund Cluster', value: '_______________' },
    ]);
  });

  it('uses the configured entity name and fund cluster', () => {
    withFormIdentity(settings, () => {
      expect(identityFields()).toEqual([
        { label: 'Entity Name', value: 'CICC CENTRAL OFFICE' },
        { label: 'Fund Cluster', value: '01 Regular Agency Fund' },
      ]);
    });
    // ...and only inside it.
    expect(formIdentity().entityName).toBe(FORM_ENTITY_NAME);
  });

  it('keeps two requests running at the same time apart', async () => {
    const seen: string[] = [];
    const later = (name: string, ms: number) =>
      withFormIdentity({ entityName: name, fundCluster: '' }, async () => {
        await new Promise((r) => setTimeout(r, ms));
        seen.push(formIdentity().entityName);
      });

    await Promise.all([later('FIRST', 20), later('SECOND', 1)]);

    expect(seen.sort()).toEqual(['FIRST', 'SECOND']);
  });

  const drawnBy = async (run: () => Promise<Buffer>) => {
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    await withFormIdentity(settings, run);
    return text.mock.calls.map(([t]) => String(t));
  };

  it('a PAR prints the configured values, not fixed text', async () => {
    const drawn = await drawnBy(() =>
      generatePAR(
        {
          propertyNumber: 'DEMO-001',
          itemDescription: 'Laptop',
          brand: 'Dell',
          serialNumber: 'SN-1',
          acquisitionCost: 46500,
          acquisitionDate: '2025-08-12',
          condition: 'serviceable',
          assetClass: 'SEP',
          officeOrSection: 'IT',
          division: 'IT',
        },
        {
          firstName: 'Juan',
          lastName: 'dela Cruz',
          employeeId: 'CICC-EMP-001',
          role: 'employee',
          division: 'Operations',
          officeOrSection: 'Field',
        },
        {
          firstName: 'Jose',
          lastName: 'Reyes',
          employeeId: 'CICC-IT-001',
          role: 'it_personnel',
          division: 'IT',
          officeOrSection: 'IT',
        },
      ),
    );

    expect(drawn).toContain(' CICC CENTRAL OFFICE');
    expect(drawn).toContain(' 01 Regular Agency Fund');
    expect(drawn.some((t) => t.includes('General Fund'))).toBe(false);
  });

  it('an RPCI prints a fill-in line when no fund cluster is set', async () => {
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    await generateRPCI([], new Date('2026-10-15'));
    const drawn = text.mock.calls.map(([t]) => String(t));

    expect(drawn).toContain(` ${FORM_ENTITY_NAME}`);
    expect(drawn).toContain(' _______________');
    expect(drawn.some((t) => t.includes('General Fund'))).toBe(false);
  });
});

describe('RPCI with many assets', () => {
  const asset = (i: number) => ({
    itemDescription: `Dell Latitude 5440 Laptop ${i}`,
    assetClass: 'SEP',
    acquisitionCost: 46500,
    condition: 'serviceable',
    quantity: 1,
  });

  it('is a handful of pages, not one page per cell', async () => {
    const pdf = await generateRPCI(
      Array.from({ length: 150 }, (_, i) => asset(i + 1)),
      new Date('2026-10-15'),
    );

    expect(pageCountOf(pdf)).toBeLessThanOrEqual(8);
  });
});

// The numbered forms used to print a number invented at render time: the
// property number as the PAR No., "ICS-" + property number, "PTR-" + the clock.
// They now print the number the service allocated for the stored form.
describe('document numbers on forms', () => {
  afterEach(() => jest.restoreAllMocks());

  const asset = {
    propertyNumber: 'DEMO-001',
    itemDescription: 'Laptop',
    brand: 'Dell',
    serialNumber: 'SN-1',
    components: null,
    accountableOfficer: 'Ana Santos',
    acquisitionCost: 46500,
    acquisitionDate: '2025-08-12',
    condition: 'serviceable',
    assetClass: 'SEP',
    officeOrSection: 'IT',
    officeLocation: 'HQ',
    division: 'IT',
    supplier: 'Acme',
    dateOfDelivery: '2025-08-10',
  };
  const user = {
    firstName: 'Juan',
    lastName: 'dela Cruz',
    employeeId: 'CICC-EMP-001',
    role: 'employee',
    division: 'Operations',
    officeOrSection: 'Field',
  };

  const forms: Array<[string, () => Promise<Buffer>]> = [
    ['PAR', () => generatePAR(asset, user, user)],
    ['ICS', () => generateICS(asset, user, user)],
    ['PTR', () => generatePTR(asset, user, 'Target Office')],
    ['IAR', () => generateIAR(asset, user)],
    ['RRSP', () => generateReceiptReturnedSEP(asset, user, user)],
    ['RRPE', () => generateReceiptReturnedProperty(asset, user, user)],
    ['RLSDDP', () => generateRLSSDDP(asset, user, 'Lost', 'Misplaced')],
    ['MOF', () => generateMoveOut(asset, user, 'Operations', 'Relocation')],
  ];

  const textOf = async (run: () => Promise<Buffer>, number?: string) => {
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    await withFormIdentity(
      { entityName: 'CICC', fundCluster: '', documentNumber: number },
      run,
    );
    return text.mock.calls.map(([t]) => String(t));
  };

  it('has no number outside a numbered request', () => {
    expect(documentNumber()).toBe('_______________');
    withFormIdentity(
      { entityName: 'CICC', fundCluster: '', documentNumber: 'PAR-2026-0007' },
      () => expect(documentNumber()).toBe('PAR-2026-0007'),
    );
  });

  it.each(forms)('%s prints the allocated number', async (series, run) => {
    const drawn = await textOf(run, `${series}-2026-0007`);

    expect(drawn.some((t) => t.includes(`${series}-2026-0007`))).toBe(true);
  });

  it.each(forms)(
    '%s never prints a number made from the clock',
    async (_series, run) => {
      const drawn = await textOf(run);

      expect(drawn.some((t) => /\d{10,}/.test(t))).toBe(false);
    },
  );

  it('a PAR does not use the property number as its own number', async () => {
    const drawn = await textOf(forms[0][1]);
    const label = drawn.indexOf('PAR No.:');

    expect(drawn[label + 1]).toBe('_______________');
  });
});

// The forms are printed and signed, so what is drawn on the page is the product.
// These guard the three layout faults found by reading the PDFs: the form number
// printed on top of its own label, tables running past the right margin, and
// words broken in the middle of a column header or a value.
describe('drawFormTitle', () => {
  it('prints the form number below its label instead of over it', () => {
    const doc = createDoc();
    const drawn = spyOnText(doc);

    drawFormTitle(
      doc,
      'PROPERTY ACKNOWLEDGMENT RECEIPT',
      'PAR No.',
      'PAR-2026-0001',
      60,
    );

    const label = drawn.find((d) => d.text === 'PAR No.:');
    const value = drawn.find((d) => d.text === 'PAR-2026-0001');
    expect(label?.y).toBeDefined();
    expect((value?.y ?? 0) - (label?.y ?? 0)).toBeGreaterThanOrEqual(8);
  });

  it('keeps the title block above the content that follows it', () => {
    const doc = createDoc();

    const end = drawFormTitle(doc, 'TITLE', 'Appendix', '75', 60);

    expect(end).toBeGreaterThan(60 + 25);
  });
});

describe('fitColumnWidths', () => {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it('scales the columns in proportion to fill the total', () => {
    expect(fitColumnWidths([100, 300], [0, 0], 200)).toEqual([50, 150]);
    expect(fitColumnWidths([100, 100], [0, 0], 400)).toEqual([200, 200]);
  });

  it('gives a column at least its minimum and takes the rest from the others', () => {
    const widths = fitColumnWidths([10, 90], [40, 0], 100);

    expect(widths[0]).toBeCloseTo(40);
    expect(widths[1]).toBeCloseTo(60);
  });

  it('always adds up to the total', () => {
    const widths = fitColumnWidths([30, 200, 60, 80], [45, 10, 50, 20], 300);

    expect(sum(widths)).toBeCloseTo(300);
    widths.forEach((w, i) =>
      expect(w).toBeGreaterThanOrEqual([45, 10, 50, 20][i] - 1e-9),
    );
  });

  it('shrinks the minimums evenly when they cannot all fit', () => {
    const widths = fitColumnWidths([50, 50], [150, 150], 200);

    expect(widths).toEqual([100, 100]);
  });
});

describe('drawTable layout', () => {
  /** Every cell/header text the table asked the document to draw, with its box width. */
  function drawnWidths(doc: PDFKit.PDFDocument) {
    const drawn: Array<{ text: string; width: number | undefined }> = [];
    const original = doc.text.bind(doc);
    jest.spyOn(doc, 'text').mockImplementation(((
      text: string,
      x?: number | string,
      y?: number | string,
      options?: PDFKit.Mixins.TextOptions,
    ) => {
      drawn.push({
        text: String(text),
        width: options?.width,
      });
      return original(text, x as number, y as number, options);
    }) as unknown as typeof doc.text);
    return drawn;
  }

  function rectsOf(doc: PDFKit.PDFDocument) {
    const rects: Array<{ x: number; w: number; h: number }> = [];
    const original = doc.rect.bind(doc);
    jest
      .spyOn(doc, 'rect')
      .mockImplementation((x: number, y: number, w: number, h: number) => {
        rects.push({ x, w, h });
        return original(x, y, w, h);
      });
    return rects;
  }

  it('shrinks a table wider than the page so nothing runs past the right margin', () => {
    const doc = createDoc();
    const rects = rectsOf(doc);

    drawTable(
      doc,
      [
        { header: 'A', width: 300 },
        { header: 'B', width: 300 },
      ],
      [['one', 'two']],
      100,
    );

    const rightmost = Math.max(...rects.map((r) => r.x + r.w));
    expect(rightmost).toBeLessThanOrEqual(PAGE.width - PAGE.margin + 0.01);
  });

  it('widens a narrow table to the content width so it lines up with the rules', () => {
    const doc = createDoc();
    const rects = rectsOf(doc);

    drawTable(
      doc,
      [
        { header: 'A', width: 100 },
        { header: 'B', width: 100 },
      ],
      [['one', 'two']],
      100,
    );

    const widest = Math.max(...rects.map((r) => r.w));
    expect(widest).toBeCloseTo(CONTENT_WIDTH, 1);
  });

  it('makes the header row tall enough for a header that wraps onto several lines', () => {
    const doc = createDoc();
    const rects = rectsOf(doc);

    drawTable(
      doc,
      [
        { header: 'EST. USEFUL LIFE', width: 30 },
        { header: 'DESCRIPTION', width: 485 },
      ],
      [['_____', 'a row']],
      100,
    );

    // The first column is held at the width of its longest word ("USEFUL"), so
    // the header wraps onto three lines inside it.
    doc.font('Helvetica-Bold').fontSize(7);
    const columnWidth = doc.widthOfString('USEFUL') + 8;
    const wrapped = doc.heightOfString('EST. USEFUL LIFE', {
      width: columnWidth - 4,
    });
    // The header used to be a fixed 20pt, so a third line printed over the first row.
    expect(wrapped).toBeGreaterThan(20);
    expect(rects[0].h).toBeGreaterThanOrEqual(wrapped);
  });

  it('never breaks a header or a value in the middle of a word', () => {
    const doc = createDoc();
    const drawn = drawnWidths(doc);
    const headers = ['REMARKS', 'CONDITION', 'DESCRIPTION'];

    drawTable(
      doc,
      [
        { header: 'REMARKS', width: 28 },
        { header: 'CONDITION', width: 40 },
        { header: 'DESCRIPTION', width: 300 },
      ],
      [['ok', 'Serviceable', 'a long description of the item']],
      100,
    );

    for (const d of drawn) {
      if (d.width === undefined) continue;
      const bold = headers.includes(d.text);
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
      const longestWord = d.text
        .split(/\s+/)
        .sort((a, b) => b.length - a.length)[0];
      expect(doc.widthOfString(longestWord)).toBeLessThanOrEqual(d.width);
    }
  });
});

describe('roleDisplay', () => {
  it.each(Object.values(UserRole))(
    'prints %s as words, never the database value',
    (role) => {
      expect(roleDisplay(role)).not.toMatch(/_/);
    },
  );

  it('names the Property Custodian, and still names the retired Property Officer for old records', () => {
    expect(roleDisplay(UserRole.PROPERTY_CUSTODIAN)).toBe('Property Custodian');
    expect(roleDisplay(UserRole.PROPERTY_OFFICER)).toBe('Property Officer');
  });
});

describe('drawMetaFields', () => {
  it('draws nothing for an empty filler field', () => {
    const doc = createDoc();
    const drawn = spyOnText(doc);

    drawMetaFields(
      doc,
      [
        { label: 'Entity Name', value: 'CICC' },
        { label: 'Date', value: '10/16/2026' },
        { label: 'Office', value: 'Systems' },
        { label: '', value: '' },
      ],
      100,
    );

    expect(drawn.map((d) => d.text)).not.toContain(':');
  });
});
