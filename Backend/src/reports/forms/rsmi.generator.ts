import {
  createDoc,
  bufferize,
  drawRepublicHeader,
  drawFormTitle,
  drawMetaFields,
  drawTable,
  drawSignatureBlock,
  phpFormat,
  fmtDate,
  PAGE,
  CONTENT_WIDTH,
  ensureSpace,
  identityFields,
} from './base-form.generator';

// SVC: Improve — RSMI aggregates RIS records for a period (Appendix 64 / RSMI)

interface RisItemLike {
  requestNumber: string;
  itemDescription: string;
  assetType: string;
  quantity: number;
  /** Unit cost of the stock the line was issued from; null when not on record. */
  acquisitionCost: number | null;
  /** The stock item's own code; null when the line was not drawn from stock. */
  stockNumber: string | null;
}

const NO_COST = '—';

export async function generateRSMI(
  items: RisItemLike[],
  dateFrom: Date,
  dateTo: Date,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'REPORT OF SUPPLIES AND MATERIALS ISSUED',
    'Appendix',
    '64',
    y,
  );

  y = drawMetaFields(
    doc,
    [
      ...identityFields(),
      { label: 'Period', value: `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}` },
      { label: 'Date Generated', value: fmtDate(new Date()) },
    ],
    y,
  );

  y += 4;

  const rows = items.map((item) => [
    item.requestNumber,
    item.stockNumber ?? '—',
    item.itemDescription,
    'unit',
    String(item.quantity),
    item.acquisitionCost === null ? NO_COST : phpFormat(item.acquisitionCost),
    item.acquisitionCost === null
      ? NO_COST
      : phpFormat(item.acquisitionCost * item.quantity),
  ]);

  y = drawTable(
    doc,
    [
      { header: 'RIS NO.', width: 85 },
      { header: 'STOCK NO.', width: 50 },
      { header: 'ITEM', width: 165 },
      { header: 'UNIT', width: 35 },
      { header: 'QTY ISSUED', width: 55 },
      { header: 'UNIT COST', width: 65 },
      { header: 'AMOUNT', width: 60 },
    ],
    rows,
    y,
  );

  // Lines with no cost on record are left out of the total rather than counted
  // as zero, and the sheet says so.
  const totalAmount = items.reduce(
    (s, i) => s + (i.acquisitionCost ?? 0) * i.quantity,
    0,
  );
  const hasUncosted = items.some((i) => i.acquisitionCost === null);
  const totalText = items.every((i) => i.acquisitionCost === null)
    ? NO_COST
    : phpFormat(totalAmount);

  y = ensureSpace(doc, y + 4, 60);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
  doc.text(`TOTAL AMOUNT: ${totalText}`, PAGE.margin + CONTENT_WIDTH - 130, y, {
    width: 130,
    align: 'right',
  });
  y += 12;
  if (hasUncosted) {
    doc.font('Helvetica').fontSize(7).fillColor('#000000');
    doc.text(
      `${NO_COST} Unit cost is not on record for this line; it is not included in the total.`,
      PAGE.margin,
      y,
      { width: CONTENT_WIDTH },
    );
    y += 12;
  }
  y += 4;

  y = ensureSpace(doc, y, 60);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('RECAPITULATION:', PAGE.margin, y);
  y += 12;
  y = drawTable(
    doc,
    [
      { header: 'UACS OBJECT CODE', width: 130 },
      { header: 'DESCRIPTION', width: 195 },
      { header: 'TOTAL QTY', width: 80 },
      { header: 'TOTAL COST', width: 110 },
    ],
    [
      [
        '—',
        'Supplies and Materials',
        String(items.reduce((s, i) => s + i.quantity, 0)),
        totalText,
      ],
    ],
    y,
  );

  y = ensureSpace(doc, y + 10, 30 + 64);
  doc.font('Helvetica').fontSize(7.5).text('Posted by:', PAGE.margin, y);
  doc
    .moveTo(PAGE.margin + 50, y + 12)
    .lineTo(PAGE.margin + 200, y + 12)
    .strokeColor('#000000')
    .lineWidth(0.5)
    .stroke();
  y += 30;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Prepared by',
        name: '___________________________',
        role: 'Supply / Property Officer',
        date: '',
      },
      {
        label: 'Certified Correct by',
        name: '___________________________',
        role: 'Head, Property Division',
        date: '',
      },
      {
        label: 'Approved by',
        name: '___________________________',
        role: 'Authorized Official',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
