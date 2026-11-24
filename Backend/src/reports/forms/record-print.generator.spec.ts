import PDFDocument from 'pdfkit';
import { generateRecordPrint } from './record-print.generator';
import { PAGE } from './base-form.generator';
import type { PrintMeta, PrintableRecord } from '../record-print';

// CICC asked for a paper copy after every step. The printout shows one record: what it is, what has
// happened to it so far, who must sign, and a number plus a code so the paper can be checked against
// the system later. The tests read what was drawn, since a PDF's text is compressed.

const meta = (over: Partial<PrintMeta> = {}): PrintMeta => ({
  printNumber: 'PR-2026-0007',
  printedAt: new Date('2026-10-18T07:10:00Z'), // 3:10 PM in Manila
  printedBy: { name: 'Maria Santos', role: 'supervisor' },
  copy: 1,
  verificationCode: 'K7Q2-9DXM',
  ...over,
});

const record = (over: Partial<PrintableRecord> = {}): PrintableRecord => ({
  kind: 'requisition',
  recordId: '11111111-1111-4111-8111-111111111111',
  title: 'REQUISITION RECORD',
  reference: 'REQ-2026-0054',
  status: 'Approved, waiting for the custodian',
  facts: [
    {
      label: 'Requested by',
      value: 'Juan dela Cruz (SBX-EMP), Field Operations',
    },
    { label: 'Date filed', value: '10/18/2026' },
  ],
  table: {
    title: 'ITEMS',
    columns: [
      { header: 'QTY', width: 30 },
      { header: 'DESCRIPTION', width: 300 },
      { header: 'TYPE', width: 100 },
    ],
    rows: [['1', 'Lenovo ThinkPad T14 Laptop', 'ICT, SEP']],
  },
  notes: [
    { label: 'Reason', value: 'A new laptop for the field data encoder.' },
  ],
  events: [
    {
      at: new Date('2026-10-18T06:30:00Z'),
      what: 'Filed',
      by: 'Juan dela Cruz',
    },
    {
      at: new Date('2026-10-18T07:10:00Z'),
      what: 'Approved: "ok"',
      by: 'Maria Santos',
    },
  ],
  nextStep: 'The IT custodian fulfils the requisition.',
  signatories: [
    { label: 'Requester', name: 'Juan dela Cruz', role: 'Employee' },
    { label: 'Approving Officer', name: 'Maria Santos', role: 'Supervisor' },
  ],
  ...over,
});

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

async function run(rec: PrintableRecord, m: PrintMeta) {
  const spy = jest.spyOn(PDFDocument.prototype, 'text');
  const before = spy.mock.calls.length;
  const buffer = await generateRecordPrint(rec, m);
  const texts = spy.mock.calls.slice(before).map(([t]) => String(t));
  const ys = spy.mock.calls
    .slice(before)
    .map(([, , y]) => (typeof y === 'number' ? y : undefined));
  spy.mockRestore();
  return { buffer, texts, ys, joined: texts.join(' | ') };
}

afterEach(() => jest.restoreAllMocks());

describe('generateRecordPrint', () => {
  it('is a PDF', async () => {
    const { buffer } = await run(record(), meta());

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('shows what the record is, its number, its state and who printed it when', async () => {
    const { joined } = await run(record(), meta());

    expect(joined).toContain('REQUISITION RECORD');
    expect(joined).toContain('PR-2026-0007');
    expect(joined).toContain('REQ-2026-0054');
    expect(joined).toContain('Approved, waiting for the custodian');
    expect(joined).toContain('Juan dela Cruz (SBX-EMP), Field Operations');
    expect(joined).toContain('Maria Santos');
    expect(joined).toContain('10/18/2026 3:10 PM');
  });

  it('lists the items and the reason', async () => {
    const { joined } = await run(record(), meta());

    expect(joined).toContain('Lenovo ThinkPad T14 Laptop');
    expect(joined).toContain('A new laptop for the field data encoder.');
  });

  it('lists every step so far, oldest first, with who did it', async () => {
    const { texts } = await run(
      record({
        events: [
          {
            at: new Date('2026-10-18T07:10:00Z'),
            what: 'Approved',
            by: 'Maria Santos',
          },
          {
            at: new Date('2026-10-18T06:30:00Z'),
            what: 'Filed',
            by: 'Juan dela Cruz',
          },
        ],
      }),
      meta(),
    );

    expect(texts.indexOf('Filed')).toBeGreaterThan(-1);
    expect(texts.indexOf('Filed')).toBeLessThan(texts.indexOf('Approved'));
  });

  it('says what happens next and gives each signer a line', async () => {
    const { joined } = await run(record(), meta());

    expect(joined).toContain('The IT custodian fulfils the requisition.');
    expect(joined).toContain('Requester');
    expect(joined).toContain('Approving Officer');
  });

  it('prints the verification code and says it was made by the system', async () => {
    const { joined } = await run(record(), meta());

    expect(joined).toContain('K7Q2-9DXM');
    expect(joined).toContain('AIMRS');
  });

  it('marks a later copy as a REPRINT and says when the first was printed', async () => {
    const { joined } = await run(
      record(),
      meta({ copy: 3, firstPrintedAt: new Date('2026-10-17T02:00:00Z') }),
    );

    expect(joined).toContain('REPRINT');
    expect(joined).toContain('copy 3');
    expect(joined).toContain('10/17/2026');
  });

  it('does not call the first copy a reprint', async () => {
    expect((await run(record(), meta({ copy: 1 }))).joined).not.toContain(
      'REPRINT',
    );
  });

  it('keeps everything above the foot of the page, even with a very long reason and many steps', async () => {
    const long = 'forensic mobile rack calibration writeblocker '
      .repeat(60)
      .trim();
    const doc = new PDFDocument();
    void doc;
    const { ys, buffer, texts } = await run(
      record({
        notes: [{ label: 'Reason', value: long }],
        events: Array.from({ length: 40 }, (_, i) => ({
          at: new Date(Date.UTC(2026, 9, 18, 0, i)),
          what: `Step ${i + 1}: ${long.slice(0, 80)}`,
          by: 'Maria Santos',
        })),
      }),
      meta(),
    );

    const foot = PAGE.height - PAGE.margin;
    // "Page n of N" is written into the bottom margin on purpose, as on every multi-page form.
    const body = ys.filter((_, i) => !/^Page \d+ of \d+$/.test(texts[i]));
    expect(body.every((y) => y === undefined || y <= foot)).toBe(true);
    expect(buffer.length).toBeGreaterThan(2000);
  });

  it('copes with nothing but the bare minimum', async () => {
    const { buffer } = await run(
      record({
        table: undefined,
        notes: [],
        events: [],
        nextStep: undefined,
        facts: [],
      }),
      meta(),
    );

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});

// Keep the helper referenced for the type check of this file's own spy utility.
void spyOnText;
