import {
  PAGE,
  bufferize,
  createDoc,
  drawSignatureBlock,
  drawTable,
} from './base-form.generator';
import { generateRPCI } from './rpci.generator';

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
