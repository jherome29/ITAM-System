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
  today,
  roleDisplay,
  fullName,
} from './base-form.generator';

// SVC: Deliver and Support — ICS generated when IT Personnel issues a SEP item (Appendix 59)

interface AssetLike {
  propertyNumber: string | null;
  itemDescription: string;
  brand: string | null;
  serialNumber: string | null;
  acquisitionCost: number;
  acquisitionDate: Date | string | null;
  condition: string;
  assetClass: string;
  officeOrSection: string | null;
}

interface UserLike {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export async function generateICS(
  asset: AssetLike,
  recipient: UserLike,
  issuer: UserLike,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  // ICS number typically references the property number
  const icsNo = `ICS-${asset.propertyNumber ?? Date.now()}`;
  y = drawFormTitle(doc, 'INVENTORY CUSTODIAN SLIP', 'ICS No.', icsNo, y);

  y = drawMetaFields(
    doc,
    [
      {
        label: 'Entity Name',
        value: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
      },
      { label: 'Fund Cluster', value: 'General Fund' },
      { label: 'Date', value: today() },
      {
        label: 'Office/Section',
        value: asset.officeOrSection ?? '_______________',
      },
    ],
    y,
  );

  y += 4;

  y = drawTable(
    doc,
    [
      { header: 'QTY', width: 35 },
      { header: 'UNIT', width: 40 },
      { header: 'INVENTORY\nITEM NO.', width: 90 },
      { header: 'DESCRIPTION', width: 165 },
      { header: 'DATE ACQUIRED', width: 80 },
      { header: 'UNIT COST', width: 75 },
      { header: 'EST. USEFUL\nLIFE', width: 30 },
    ],
    [
      [
        '1',
        'unit',
        asset.propertyNumber ?? '',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}${asset.serialNumber ? '\nS/N: ' + asset.serialNumber : ''}`,
        fmtDate(asset.acquisitionDate),
        phpFormat(asset.acquisitionCost),
        '—',
      ],
    ],
    y,
  );

  y += 6;
  doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
  doc.text(
    'I hereby acknowledge receipt of the semi-expendable property listed above in good order and condition. ' +
      'I am responsible for its safekeeping and proper use.',
    40,
    y,
    { width: 515, align: 'justify' },
  );
  y += 28;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Received from (Supply Officer)',
        name: fullName(issuer.firstName, issuer.lastName),
        role: `${roleDisplay(issuer.role)} / ${issuer.employeeId}`,
        date: '',
      },
      {
        label: 'Received by (End User)',
        name: fullName(recipient.firstName, recipient.lastName),
        role: `${roleDisplay(recipient.role)} / ${recipient.employeeId}`,
        date: '',
      },
      {
        label: 'Head, Property / Supply Division',
        name: '___________________________',
        role: 'Authorized Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
