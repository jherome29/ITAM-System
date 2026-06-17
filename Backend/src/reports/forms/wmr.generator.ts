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
} from './base-form.generator';

// SVC: Deliver and Support — WMR documents waste/unserviceable materials for a period (Appendix 65)

interface AssetLike {
  propertyNumber: string | null;
  itemDescription: string;
  brand: string | null;
  acquisitionCost: number;
  condition: string;
}

export async function generateWMR(
  assets: AssetLike[],
  dateFrom: Date,
  dateTo: Date,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(doc, 'WASTE MATERIALS REPORT', 'Appendix', '65', y);

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

  const rows = assets.map((a) => [
    'unit',
    a.itemDescription + (a.brand ? ' / ' + a.brand : ''),
    '1',
    phpFormat(a.acquisitionCost),
    a.condition,
  ]);

  y = drawTable(
    doc,
    [
      { header: 'UNIT', width: 45 },
      { header: 'DESCRIPTION', width: 240 },
      { header: 'QTY', width: 40 },
      { header: 'ESTIMATED VALUE', width: 110 },
      { header: 'REMARKS', width: 80 },
    ],
    rows,
    y,
  );

  const total = assets.reduce((s, a) => s + Number(a.acquisitionCost), 0);
  y += 4;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
  doc.text(`TOTAL ESTIMATED VALUE: ${phpFormat(total)}`, 40, y);
  y += 20;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Inspected by',
        name: '___________________________',
        role: 'Inspection Officer',
        date: '',
      },
      {
        label: 'Disposed by',
        name: '___________________________',
        role: 'IT Personnel / Supply Officer',
        date: '',
      },
      {
        label: 'Authorized by',
        name: '___________________________',
        role: 'Division Head / Admin Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
