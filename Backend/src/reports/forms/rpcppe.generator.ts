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

// SVC: Improve — RPCPPE for annual physical count of PPE (Appendix 73)

interface AssetLike {
  propertyNumber: string | null;
  itemDescription: string;
  brand: string | null;
  serialNumber: string | null;
  acquisitionCost: number;
  acquisitionDate: Date | string | null;
  condition: string;
  division: string | null;
  officeOrSection: string | null;
  accountableOfficer: string | null;
}

export async function generateRPCPPE(
  assets: AssetLike[],
  asOf: Date,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'REPORT ON PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT',
    'Appendix',
    '73',
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
    a.propertyNumber ?? '—',
    a.itemDescription + (a.brand ? ' / ' + a.brand : ''),
    a.serialNumber ?? '—',
    fmtDate(a.acquisitionDate),
    phpFormat(a.acquisitionCost),
    a.condition,
    a.officeOrSection ?? '—',
    a.accountableOfficer ?? '—',
  ]);

  y = drawTable(
    doc,
    [
      { header: 'PROPERTY NO.', width: 90 },
      { header: 'DESCRIPTION', width: 135 },
      { header: 'SERIAL NO.', width: 80 },
      { header: 'DATE ACQUIRED', width: 70 },
      { header: 'ACQUISITION COST', width: 75 },
      { header: 'CONDITION', width: 50 },
      { header: 'LOCATION', width: 60 },
      { header: 'ACCOUNTABLE\nOFFICER', width: 75 },
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
        role: 'Admin / Accountable Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
