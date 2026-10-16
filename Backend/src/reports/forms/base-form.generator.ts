import { AsyncLocalStorage } from 'node:async_hooks';
import PDFDocument from 'pdfkit';
import { FORM_ENTITY_NAME } from '../../../../packages/shared/src/constants';

// SVC: Improve — shared pdfkit utilities for all COA official form generators

export const PAGE = { width: 595.28, height: 841.89, margin: 40 } as const;
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
/** The lowest y anything may be drawn at: past it pdfkit silently starts a new page for each text call. */
export const CONTENT_BOTTOM = PAGE.height - PAGE.margin;

// ── Who the form is for ──────────────────────────────────────────────────────
// The agency name and Fund Cluster in the header come from the system settings.
// The generators are plain functions, so the values travel with the request
// instead of through every signature: ReportsService runs a generator inside
// withFormIdentity(), and the header helpers read it back. Request-scoped, so two
// forms being generated at once never see each other's settings.

export interface FormIdentity {
  entityName: string;
  /** Empty until CICC has set one; the form then prints a fill-in line. */
  fundCluster: string;
  /** The running number allocated to this form, for the forms that carry one. */
  documentNumber?: string;
}

const DEFAULT_IDENTITY: FormIdentity = {
  entityName: FORM_ENTITY_NAME,
  fundCluster: '',
};
const identityStore = new AsyncLocalStorage<FormIdentity>();

/** Runs `run` (a form generator) with the given identity in effect. */
export function withFormIdentity<T>(identity: FormIdentity, run: () => T): T {
  return identityStore.run(identity, run);
}

export function formIdentity(): FormIdentity {
  return identityStore.getStore() ?? DEFAULT_IDENTITY;
}

/** The "Entity Name" and "Fund Cluster" header fields of an official form. */
export function identityFields(): { label: string; value: string }[] {
  const { entityName, fundCluster } = formIdentity();
  return [
    { label: 'Entity Name', value: entityName },
    { label: 'Fund Cluster', value: fundCluster || '_______________' },
  ];
}

const NUMBER_FILL_IN = '_______________';

/** The form's own running number, or a fill-in line when none was allocated. */
export function documentNumber(): string {
  return formIdentity().documentNumber ?? NUMBER_FILL_IN;
}

export const FONT_REGULAR = 'Helvetica';
export const FONT_BOLD = 'Helvetica-Bold';
export const GRAY_LIGHT = '#f5f5f5';
export const GRAY_BORDER = '#888888';
export const BLACK = '#000000';

/**
 * Creates a new A4 PDFDocument with standard margins. Pages are buffered so
 * bufferize() can number them once the page count is known.
 */
export function createDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    margins: {
      top: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    autoFirstPage: true,
    bufferPages: true,
  });
}

/**
 * The page a management report (Asset Master List, Audit Trail ...) is drawn on: landscape
 * letter, because those tables have many columns. Pages added later keep the layout.
 */
export function createReportDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'LETTER',
    layout: 'landscape',
    margins: {
      top: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    autoFirstPage: true,
    bufferPages: true,
  });
}

/**
 * The writable area of the page the document is on. Read from the page rather than from
 * the A4 constants so the same table code serves a landscape report: on an A4 form it comes
 * to exactly PAGE.margin, CONTENT_WIDTH and CONTENT_BOTTOM.
 */
function pageBox(doc: PDFKit.PDFDocument): {
  left: number;
  top: number;
  width: number;
  bottom: number;
} {
  const m = doc.page.margins;
  return {
    left: m.left,
    top: m.top,
    width: doc.page.width - m.left - m.right,
    bottom: doc.page.height - m.bottom,
  };
}

/**
 * Makes room for `needed` points below `y`: returns `y` when it fits, otherwise
 * starts a new page and returns the top margin. Anything drawn after a table
 * (signature blocks, totals) goes through this so it never lands off the page.
 */
export function ensureSpace(
  doc: PDFKit.PDFDocument,
  y: number,
  needed: number,
): number {
  const box = pageBox(doc);
  if (y + needed <= box.bottom) return y;
  doc.addPage();
  return box.top;
}

/**
 * Draws the Republic of the Philippines / CICC header.
 * Returns the Y position immediately after the header.
 */
export function drawRepublicHeader(doc: PDFKit.PDFDocument): number {
  const cx = PAGE.width / 2;
  let y = PAGE.margin;

  doc.font(FONT_REGULAR).fontSize(7).fillColor(BLACK);
  doc.text('Republic of the Philippines', PAGE.margin, y, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
  y += 10;
  doc.text(
    'Department of Information and Communications Technology',
    PAGE.margin,
    y,
    { width: CONTENT_WIDTH, align: 'center' },
  );
  y += 10;
  doc.font(FONT_BOLD).fontSize(9);
  doc.text(formIdentity().entityName.toUpperCase(), PAGE.margin, y, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
  y += 11;
  doc.font(FONT_REGULAR).fontSize(7);
  doc.text(
    'Telecom Plaza Bldg., Sen. Gil Puyat Ave., Makati City / National Cybercrime Hub, Taguig City',
    PAGE.margin,
    y,
    { width: CONTENT_WIDTH, align: 'center' },
  );
  y += 9;
  doc.text('www.cicc.gov.ph', PAGE.margin, y, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
  y += 14;

  // Divider line
  doc
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .strokeColor(BLACK)
    .lineWidth(1)
    .stroke();
  y += 6;
  void cx;
  return y;
}

const REFERENCE_FONT_SIZE = 9;

/**
 * Draws a centered form title in bold and the form reference number on the right.
 * Returns Y after the title block.
 */
export function drawFormTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  formRefLabel: string,
  formRefValue: string,
  y: number,
): number {
  doc.font(FONT_BOLD).fontSize(11).fillColor(BLACK);
  doc.text(title, PAGE.margin, y, {
    width: CONTENT_WIDTH - 120,
    align: 'center',
  });

  // The reference box has two lines - the label, then the value on top of the
  // rule. They used to be drawn 2pt apart, so the number printed over its label.
  const boxWidth = 118;
  const rx = PAGE.width - PAGE.margin - boxWidth;
  doc.font(FONT_REGULAR).fontSize(7).fillColor(BLACK);
  doc.text(`${formRefLabel}:`, rx, y, { width: boxWidth, lineBreak: false });

  // A long reference ("SS-02 / MOF-2026-0001") shrinks to stay inside the box.
  doc.font(FONT_BOLD).fontSize(REFERENCE_FONT_SIZE);
  const valueWidth = doc.widthOfString(formRefValue);
  if (valueWidth > boxWidth) {
    doc.fontSize(Math.max(6, (REFERENCE_FONT_SIZE * boxWidth) / valueWidth));
  }
  doc.text(formRefValue, rx, y + 10, { width: boxWidth, lineBreak: false });

  y += 22;
  doc
    .moveTo(rx, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .strokeColor(BLACK)
    .lineWidth(0.5)
    .stroke();
  y += 4;

  doc
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .strokeColor(BLACK)
    .lineWidth(1.5)
    .stroke();
  y += 8;
  return y;
}

/**
 * Draws header meta fields in a 2-column key:value layout.
 * fields = [{label, value}, ...]
 * Returns Y after the last field.
 */
export function drawMetaFields(
  doc: PDFKit.PDFDocument,
  fields: { label: string; value: string }[],
  y: number,
): number {
  const half = CONTENT_WIDTH / 2;
  for (let i = 0; i < fields.length; i += 2) {
    const left = fields[i];
    const right = fields[i + 1];
    doc.font(FONT_BOLD).fontSize(7.5).fillColor(BLACK);
    doc.text(`${left.label}:`, PAGE.margin, y, { continued: true });
    doc
      .font(FONT_REGULAR)
      .fontSize(7.5)
      .text(` ${left.value}`, { width: half - 10 });
    // An empty label is a filler that keeps the pairs aligned: draw nothing.
    if (right?.label) {
      doc.font(FONT_BOLD).fontSize(7.5).fillColor(BLACK);
      doc.text(`${right.label}:`, PAGE.margin + half, y, { continued: true });
      doc
        .font(FONT_REGULAR)
        .fontSize(7.5)
        .text(` ${right.value}`, { width: half - 10 });
    }
    y += 13;
  }
  return y;
}

/**
 * Widths for a table's columns that add up to exactly `total`: the caller's
 * proportions, except that no column goes below its minimum (the width of its
 * longest unbreakable word). A column held at its minimum is taken out of the
 * sharing and the rest are scaled again until every column fits. When even the
 * minimums do not fit, they are shrunk evenly - a word may then break.
 */
export function fitColumnWidths(
  desired: number[],
  mins: number[],
  total: number,
): number[] {
  const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const minTotal = sumOf(mins);
  if (minTotal >= total) return mins.map((m) => (m * total) / minTotal);

  const wanted = desired.map((w) => (w > 0 ? w : 1));
  const held = new Set<number>();
  let widths: number[] = [];
  for (let pass = 0; pass <= wanted.length; pass++) {
    const sharedWanted = sumOf(wanted.filter((_, i) => !held.has(i)));
    const sharedTotal = total - sumOf(mins.filter((_, i) => held.has(i)));
    widths = wanted.map((w, i) =>
      held.has(i) ? mins[i] : (w * sharedTotal) / sharedWanted,
    );
    const short = widths
      .map((w, i) => (!held.has(i) && w < mins[i] ? i : -1))
      .filter((i) => i >= 0);
    if (short.length === 0) break;
    short.forEach((i) => held.add(i));
  }
  return widths;
}

/** Room a column needs beside its longest word: 3pt padding each side plus slack. */
const COLUMN_SIDE_ROOM = 8;
/** A longer unbroken value (a URL, say) wraps instead of starving its neighbours. */
const MAX_WORD_ROOM = 90;

function longestWord(text: string): string {
  let longest = '';
  for (const word of text.split(/\s+/)) {
    if (word.length > longest.length) longest = word;
  }
  return longest;
}

/** How many of a report's first rows to read when judging how much room each column wants. */
const PROPORTION_SAMPLE_ROWS = 200;
/** A column never asks for more than this many characters' worth, so one long text cannot starve the rest. */
const MAX_COLUMN_UNITS = 40;
/** ...nor for fewer than this, so a short code still gets a legible column. */
const MIN_COLUMN_UNITS = 6;

/**
 * Proportions for the columns of a report, from what they hold: a description column is
 * given far more room than a class code. drawTable scales them to the page and holds each
 * column to its longest word, so these only have to be in the right ratio.
 */
export function columnProportions(
  headers: string[],
  rows: string[][],
): number[] {
  const sample = rows.slice(0, PROPORTION_SAMPLE_ROWS);
  return headers.map((header, i) => {
    const average = sample.length
      ? sample.reduce((sum, row) => sum + String(row[i] ?? '').length, 0) /
        sample.length
      : 0;
    return Math.min(
      Math.max(average, String(header).length, MIN_COLUMN_UNITS),
      MAX_COLUMN_UNITS,
    );
  });
}

/**
 * The columns scaled to the content width, so a table neither runs past the
 * right margin nor stops short of the rules above and below it, and no column
 * is so narrow that its header or a value breaks in the middle of a word
 * ("REM/ARK/S", "Serviceabl/e"). Callers give proportions; this makes them fit.
 */
function fitColumns(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number }[],
  rows: string[][],
  totalWidth: number,
): { header: string; width: number }[] {
  const mins = cols.map((col, i) => {
    doc.font(FONT_BOLD).fontSize(7);
    const header = doc.widthOfString(longestWord(col.header));
    let widest = '';
    for (const row of rows) {
      const word = longestWord(String(row[i] ?? ''));
      if (word.length > widest.length) widest = word;
    }
    doc.font(FONT_REGULAR).fontSize(7);
    const body = doc.widthOfString(widest);
    return Math.min(Math.max(header, body) + COLUMN_SIDE_ROOM, MAX_WORD_ROOM);
  });
  const widths = fitColumnWidths(
    cols.map((c) => c.width),
    mins,
    totalWidth,
  );
  return cols.map((col, i) => ({ ...col, width: widths[i] }));
}

const TABLE_HEADER_HEIGHT = 20;
/** Room a row's text needs above and below it inside its cell. */
const CELL_PADDING = 8;

/** The header row grows with its tallest header, so a wrapped one stays inside it. */
function tableHeaderHeight(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number }[],
): number {
  doc.font(FONT_BOLD).fontSize(7);
  const tallest = Math.max(
    ...cols.map((c) =>
      doc.heightOfString(c.header, { width: c.width - 4, align: 'center' }),
    ),
  );
  // 4pt above the text (where it is drawn) and the same below it.
  return Math.max(TABLE_HEADER_HEIGHT, tallest + 8);
}

/** Draws the shaded column-header row at `y`; returns the y below it. */
function drawTableHeader(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number }[],
  x: number,
  y: number,
  height: number,
): number {
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  doc.rect(x, y, tableWidth, height).fillAndStroke(GRAY_LIGHT, GRAY_BORDER);

  let cx = x;
  for (const col of cols) {
    doc.font(FONT_BOLD).fontSize(7).fillColor(BLACK);
    doc.text(col.header, cx + 2, y + 4, {
      width: col.width - 4,
      align: 'center',
    });
    cx += col.width;
  }
  return y + height;
}

/**
 * Draws a bordered table with a shaded header row.
 * cols = [{header, width (px)}]
 * rows = string[][] each row's cell values
 * rowHeight is the minimum height: a row grows to fit text that wraps.
 *
 * The table flows onto further pages (repeating the header) rather than running
 * past the bottom margin - pdfkit answers any text drawn there with a new page
 * per cell, which turned a 55-asset count sheet into 211 one-word pages.
 * Returns Y after the table, on its last page.
 */
export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: { header: string; width: number }[],
  rows: string[][],
  y: number,
  rowHeight = 18,
): number {
  const box = pageBox(doc);
  const cols = fitColumns(doc, columns, rows, box.width);
  const headerHeight = tableHeaderHeight(doc, cols);
  const tableWidth = box.width;
  const startX = box.left;

  // The header never sits alone at the foot of a page: it needs room for itself
  // and a first row.
  if (y + headerHeight + rowHeight > box.bottom) {
    doc.addPage();
    y = box.top;
  }
  y = drawTableHeader(doc, cols, startX, y, headerHeight);

  for (const row of rows) {
    const cells = cols.map((_, i) => (row[i] ?? '').toString());
    doc.font(FONT_REGULAR).fontSize(7);
    const height = Math.max(
      rowHeight,
      ...cells.map(
        (text, i) =>
          doc.heightOfString(text, { width: cols[i].width - 6 }) + CELL_PADDING,
      ),
    );

    if (y + height > box.bottom) {
      doc.addPage();
      y = drawTableHeader(doc, cols, startX, box.top, headerHeight);
    }

    // Row border
    doc.rect(startX, y, tableWidth, height).stroke(GRAY_BORDER);

    let cx = startX;
    for (let i = 0; i < cols.length; i++) {
      doc.font(FONT_REGULAR).fontSize(7).fillColor(BLACK);
      doc.text(cells[i], cx + 3, y + 4, {
        width: cols[i].width - 6,
        align: 'left',
      });
      // Vertical cell divider
      if (i < cols.length - 1) {
        doc
          .moveTo(cx + cols[i].width, y)
          .lineTo(cx + cols[i].width, y + height)
          .stroke(GRAY_BORDER);
      }
      cx += cols[i].width;
    }
    y += height;
  }

  // Bottom border
  doc
    .moveTo(startX, y)
    .lineTo(startX + tableWidth, y)
    .stroke(GRAY_BORDER);
  return y + 6;
}

/** Vertical space a signature block takes (label, line, name, role, date). */
const SIGNATURE_BLOCK_HEIGHT = 64;

/**
 * Draws a signature block with equal-width columns.
 * signatories = [{label, name, role, date?}]
 * Text-only signature lines — no images or digital signatures (COA compliance).
 */
export function drawSignatureBlock(
  doc: PDFKit.PDFDocument,
  signatories: { label: string; name: string; role: string; date?: string }[],
  y: number,
): number {
  // Kept together: a block that does not fit under the table starts a new page.
  y = ensureSpace(doc, y, SIGNATURE_BLOCK_HEIGHT);
  const colW = CONTENT_WIDTH / signatories.length;
  const signLineY = y + 28;

  for (let i = 0; i < signatories.length; i++) {
    const x = PAGE.margin + i * colW;
    const sig = signatories[i];

    doc.font(FONT_BOLD).fontSize(7.5).fillColor(BLACK);
    doc.text(sig.label + ':', x, y, { width: colW - 6 });

    // Blank signature line
    doc
      .moveTo(x + 4, signLineY)
      .lineTo(x + colW - 10, signLineY)
      .strokeColor(BLACK)
      .lineWidth(0.5)
      .stroke();

    doc.font(FONT_BOLD).fontSize(7.5).fillColor(BLACK);
    doc.text(sig.name, x + 4, signLineY + 2, { width: colW - 10 });
    doc.font(FONT_REGULAR).fontSize(7);
    doc.text(sig.role, x + 4, signLineY + 11, { width: colW - 10 });
    doc.text(
      `Date: ${sig.date ?? '_________________________'}`,
      x + 4,
      signLineY + 20,
      { width: colW - 10 },
    );
  }

  return signLineY + 36;
}

/**
 * Writes "Page n of N" at the foot of every page of a multi-page form. A
 * single-page form is left as the official template has it.
 */
function addPageNumbers(doc: PDFKit.PDFDocument): void {
  const { start, count } = doc.bufferedPageRange();
  if (count < 2) return;
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    // The footer sits inside the bottom margin; drawing there would otherwise
    // make pdfkit start another page, so lift the margin while writing it.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(FONT_REGULAR)
      .fontSize(7)
      .fillColor('#666666')
      .text(`Page ${i + 1} of ${count}`, PAGE.margin, doc.page.height - 28, {
        width: doc.page.width - PAGE.margin * 2,
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = bottom;
  }
}

/**
 * Collects pdfkit stream output into a single Buffer.
 */
export function bufferize(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    addPageNumbers(doc);
    doc.end();
  });
}

/** Formats PHP currency. */
/** 'for_repair' -> 'For repair'. Forms print words, not database values. */
export function conditionLabel(condition: string | null | undefined): string {
  if (!condition) return '—';
  const words = condition.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function phpFormat(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return 'PHP 0.00';
  return (
    'PHP ' +
    new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  );
}

/** Formats a Date or ISO string to MM/DD/YYYY. */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '_______________';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '_______________';
  return date.toLocaleDateString('en-PH', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/** Formats today as MM/DD/YYYY. */
export function today(): string {
  return fmtDate(new Date());
}

/** Formats a user role enum to display text for signature blocks. */
export function roleDisplay(role: string): string {
  const map: Record<string, string> = {
    it_personnel: 'IT Personnel / Supply Officer',
    system_admin: 'System Administrator',
    supervisor: 'Division Supervisor',
    employee: 'End User',
    management: 'Management',
    property_custodian: 'Property Custodian',
    property_officer: 'Property Officer',
  };
  return map[role] ?? role;
}

/** Full name from user entity fields. */
export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
