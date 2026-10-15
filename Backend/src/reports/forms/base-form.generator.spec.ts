import PDFDocument from 'pdfkit';
import {
  PAGE,
  bufferize,
  createDoc,
  drawSignatureBlock,
  drawTable,
  formIdentity,
  documentNumber,
  identityFields,
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
