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

// SVC: Improve — RPCI for periodic physical count of inventories/supplies (Appendix 66)

interface AssetLike {
  itemDescription: string;
  assetClass: string;
  acquisitionCost: number;
  condition: string;
}

export async function generateRPCI(
  assets: AssetLike[],
  asOf: Date,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'REPORT ON PHYSICAL COUNT OF INVENTORIES',
    'Appendix',
    '66',
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
      { label: 'As at', value: fmtDate(asOf) },
      { label: 'Date Generated', value: fmtDate(new Date()) },
    ],
    y,
  );

  y += 4;

  const rows = assets.map((a) => [
    a.assetClass,
    a.itemDescription,
    'unit',
    phpFormat(a.acquisitionCost),
    '1',
    '1',
    '',
    '',
    a.condition,
  ]);

  y = drawTable(
    doc,
    [
      { header: 'ARTICLE', width: 45 },
      { header: 'DESCRIPTION', width: 160 },
      { header: 'UNIT', width: 35 },
      { header: 'UNIT COST', width: 65 },
      { header: 'QTY PER\nCARD', width: 45 },
      { header: 'QTY PER\nCOUNT', width: 45 },
      { header: 'SHORT-\nAGE', width: 40 },
      { header: 'OVER-\nAGE', width: 40 },
      { header: 'REMARKS', width: 40 },
    ],
    rows,
    y,
  );

  y += 12;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Counted by',
        name: '___________________________',
        role: 'IT Personnel / Property Officer',
        date: '',
      },
      {
        label: 'Verified by',
        name: '___________________________',
        role: 'Supply / Property Officer',
        date: '',
      },
      {
        label: 'Certified Correct by',
        name: '___________________________',
        role: 'Accountable Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
