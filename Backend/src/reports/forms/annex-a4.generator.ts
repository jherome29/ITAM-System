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

// SVC: Improve — Annex A.4 registry of all SEP items issued for a period

interface AssetIssuanceLike {
  propertyNumber: string | null;
  itemDescription: string;
  serialNumber: string | null;
  acquisitionCost: number;
  acquisitionDate: Date | string | null;
  custodianName?: string;
  officeOrSection?: string | null;
}

export async function generateAnnexA4(
  assets: AssetIssuanceLike[],
  dateFrom: Date,
  dateTo: Date,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'REGISTRY OF SEMI-EXPENDABLE PROPERTY ISSUED',
    'Annex',
    'A.4',
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

  const rows = assets.map((a) => [
    fmtDate(a.acquisitionDate),
    `ICS-${a.propertyNumber ?? '—'}`,
    a.itemDescription + (a.serialNumber ? `\nS/N: ${a.serialNumber}` : ''),
    a.propertyNumber ?? '—',
    '1',
    a.custodianName ?? '_______________',
    a.officeOrSection ?? '—',
    phpFormat(a.acquisitionCost),
    '',
  ]);

  y = drawTable(
    doc,
    [
      { header: 'DATE', width: 65 },
      { header: 'ICS NO.', width: 75 },
      { header: 'ITEM DESCRIPTION', width: 150 },
      { header: 'SEP NO.', width: 70 },
      { header: 'QTY', width: 30 },
      { header: 'END-USER', width: 80 },
      { header: 'OFFICE', width: 60 },
      { header: 'UNIT COST', width: 60 },
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
