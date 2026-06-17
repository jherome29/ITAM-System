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

// SVC: Improve — RSPI aggregates SEP issuances for a period (Annex A.7)

interface AssetIssuanceLike {
  propertyNumber: string | null;
  itemDescription: string;
  serialNumber: string | null;
  acquisitionCost: number;
  custodianName?: string;
}

export async function generateRSPI(
  assets: AssetIssuanceLike[],
  dateFrom: Date,
  dateTo: Date,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'REPORT OF SEMI-EXPENDABLE PROPERTY ISSUED',
    'Annex',
    'A.7',
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

  const rows = assets.map((a, i) => [
    `ICS-${a.propertyNumber ?? i + 1}`,
    '—',
    a.propertyNumber ?? '—',
    a.itemDescription + (a.serialNumber ? `\nS/N: ${a.serialNumber}` : ''),
    'unit',
    '1',
    phpFormat(a.acquisitionCost),
    phpFormat(a.acquisitionCost),
  ]);

  y = drawTable(
    doc,
    [
      { header: 'ICS NO.', width: 80 },
      { header: 'RC CODE', width: 45 },
      { header: 'SEP NO.', width: 80 },
      { header: 'ITEM DESCRIPTION', width: 135 },
      { header: 'UNIT', width: 35 },
      { header: 'QTY', width: 30 },
      { header: 'UNIT COST', width: 65 },
      { header: 'AMOUNT', width: 65 },
    ],
    rows,
    y,
  );

  const total = assets.reduce((s, a) => s + Number(a.acquisitionCost), 0);
  y += 4;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
  doc.text(`TOTAL: ${phpFormat(total)}`, PAGE.margin + CONTENT_WIDTH - 130, y, {
    width: 130,
    align: 'right',
  });
  y += 20;

  doc.font('Helvetica').fontSize(7.5);
  doc.text(
    'I hereby certify to the correctness of the above information.',
    PAGE.margin,
    y,
    { width: CONTENT_WIDTH },
  );
  y += 20;

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
        label: 'Noted by (Accounting)',
        name: '___________________________',
        role: 'Accounting Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
