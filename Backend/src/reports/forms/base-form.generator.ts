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
 * Makes room for `needed` points below `y`: returns `y` when it fits, otherwise
 * starts a new page and returns the top margin. Anything drawn after a table
 * (signature blocks, totals) goes through this so it never lands off the page.
 */
export function ensureSpace(
  doc: PDFKit.PDFDocument,
  y: number,
  needed: number,
): number {
  if (y + needed <= CONTENT_BOTTOM) return y;
  doc.addPage();
  return PAGE.margin;
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

  doc.font(FONT_REGULAR).fontSize(8);
  const rx = PAGE.width - PAGE.margin - 118;
  doc.text(`${formRefLabel}:`, rx, y, { width: 118 });
  y += 11;
  doc
    .moveTo(rx, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .strokeColor(BLACK)
    .lineWidth(0.5)
    .stroke();
  doc.font(FONT_BOLD).fontSize(9).fillColor(BLACK);
  doc.text(formRefValue, rx, y - 9, { width: 118 });
  y += 10;

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
    if (right) {
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

const TABLE_HEADER_HEIGHT = 20;
/** Room a row's text needs above and below it inside its cell. */
const CELL_PADDING = 8;

/** Draws the shaded column-header row at `y`; returns the y below it. */
function drawTableHeader(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number }[],
  y: number,
): number {
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  doc
    .rect(PAGE.margin, y, tableWidth, TABLE_HEADER_HEIGHT)
    .fillAndStroke(GRAY_LIGHT, GRAY_BORDER);

  let cx = PAGE.margin;
  for (const col of cols) {
    doc.font(FONT_BOLD).fontSize(7).fillColor(BLACK);
    doc.text(col.header, cx + 2, y + 4, {
      width: col.width - 4,
      align: 'center',
    });
    cx += col.width;
  }
  return y + TABLE_HEADER_HEIGHT;
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
  cols: { header: string; width: number }[],
  rows: string[][],
  y: number,
  rowHeight = 18,
): number {
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  const startX = PAGE.margin;

  // The header never sits alone at the foot of a page: it needs room for itself
  // and a first row.
  if (y + TABLE_HEADER_HEIGHT + rowHeight > CONTENT_BOTTOM) {
    doc.addPage();
    y = PAGE.margin;
  }
  y = drawTableHeader(doc, cols, y);

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

    if (y + height > CONTENT_BOTTOM) {
      doc.addPage();
      y = drawTableHeader(doc, cols, PAGE.margin);
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
      .text(`Page ${i + 1} of ${count}`, PAGE.margin, PAGE.height - 28, {
        width: CONTENT_WIDTH,
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
  };
  return map[role] ?? role;
}

/** Full name from user entity fields. */
export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
