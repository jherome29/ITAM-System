import PDFDocument from 'pdfkit';

// SVC: Improve — shared pdfkit utilities for all COA official form generators

export const PAGE = { width: 595.28, height: 841.89, margin: 40 } as const;
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
export const FONT_REGULAR = 'Helvetica';
export const FONT_BOLD = 'Helvetica-Bold';
export const GRAY_LIGHT = '#f5f5f5';
export const GRAY_BORDER = '#888888';
export const BLACK = '#000000';

/** Creates a new A4 PDFDocument with standard margins. */
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
  });
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
  doc.text('CYBERCRIME INVESTIGATION AND COORDINATING CENTER', PAGE.margin, y, {
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

/**
 * Draws a bordered table with a shaded header row.
 * cols = [{header, width (px)}]
 * rows = string[][] each row's cell values
 * Returns Y after the table.
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
  const headerH = 20;

  // Header background
  doc
    .rect(startX, y, tableWidth, headerH)
    .fillAndStroke(GRAY_LIGHT, GRAY_BORDER);

  // Header text
  let cx = startX;
  for (const col of cols) {
    doc.font(FONT_BOLD).fontSize(7).fillColor(BLACK);
    doc.text(col.header, cx + 2, y + 4, {
      width: col.width - 4,
      align: 'center',
    });
    cx += col.width;
  }
  y += headerH;

  // Data rows
  for (const row of rows) {
    // Row border
    doc.rect(startX, y, tableWidth, rowHeight).stroke(GRAY_BORDER);

    cx = startX;
    for (let i = 0; i < cols.length; i++) {
      const cellText = (row[i] ?? '').toString();
      doc.font(FONT_REGULAR).fontSize(7).fillColor(BLACK);
      doc.text(cellText, cx + 3, y + 4, {
        width: cols[i].width - 6,
        align: 'left',
        lineBreak: false,
      });
      // Vertical cell divider
      if (i < cols.length - 1) {
        doc
          .moveTo(cx + cols[i].width, y)
          .lineTo(cx + cols[i].width, y + rowHeight)
          .stroke(GRAY_BORDER);
      }
      cx += cols[i].width;
    }
    y += rowHeight;
  }

  // Bottom border
  doc
    .moveTo(startX, y)
    .lineTo(startX + tableWidth, y)
    .stroke(GRAY_BORDER);
  return y + 6;
}

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
 * Collects pdfkit stream output into a single Buffer.
 */
export function bufferize(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
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
