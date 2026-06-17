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
} from './base-form.generator';

// SVC: Improve — RSMI aggregates RIS records for a period (Appendix 64 / RSMI)

interface RisItemLike {
  requestNumber: string;
  itemDescription: string;
  assetType: string;
  quantity: number;
  acquisitionCost?: number;
}

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
      {
        label: 'Entity Name',
        value: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
      },
      { label: 'Fund Cluster', value: 'General Fund' },
      { label: 'Period', value: `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}` },
      { label: 'Date Generated', value: fmtDate(new Date()) },
    ],
    y,
  );

  y += 4;

  const rows = items.map((item, i) => [
    item.requestNumber,
    String(i + 1).padStart(3, '0'),
    item.itemDescription,
    'unit',
    String(item.quantity),
    phpFormat(item.acquisitionCost ?? 0),
    phpFormat((item.acquisitionCost ?? 0) * item.quantity),
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

  const totalAmount = items.reduce(
    (s, i) => s + (i.acquisitionCost ?? 0) * i.quantity,
    0,
  );

  y += 4;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
  doc.text(
    `TOTAL AMOUNT: ${phpFormat(totalAmount)}`,
    PAGE.margin + CONTENT_WIDTH - 130,
    y,
    { width: 130, align: 'right' },
  );
  y += 16;

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
        phpFormat(totalAmount),
      ],
    ],
    y,
  );

  y += 10;
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
