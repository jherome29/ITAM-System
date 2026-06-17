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

// SVC: Deliver and Support — PAR generated when IT Personnel issues a PPE item to an employee (Appendix 71)

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
  division: string | null;
}

interface UserLike {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export async function generatePAR(
  asset: AssetLike,
  recipient: UserLike,
  issuer: UserLike,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'PROPERTY ACKNOWLEDGMENT RECEIPT',
    'PAR No.',
    asset.propertyNumber ?? '_______________',
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
      { header: 'PROPERTY NO.', width: 100 },
      { header: 'DESCRIPTION', width: 160 },
      { header: 'DATE ACQUIRED', width: 80 },
      { header: 'ACQUISITION COST', width: 80 },
      { header: 'REMARKS', width: 20 },
    ],
    [
      [
        '1',
        'unit',
        asset.propertyNumber ?? '',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}${asset.serialNumber ? '\nS/N: ' + asset.serialNumber : ''}`,
        fmtDate(asset.acquisitionDate),
        phpFormat(asset.acquisitionCost),
        '',
      ],
    ],
    y,
  );

  y += 6;
  doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
  doc.text(
    'I hereby acknowledge receipt of the property/ies described above in good order and condition. ' +
      'I will be responsible for its safekeeping and will return the same when no longer needed.',
    40,
    y,
    { width: 515, align: 'justify' },
  );
  y += 28;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Received by (End User)',
        name: fullName(recipient.firstName, recipient.lastName),
        role: `${roleDisplay(recipient.role)} / ${recipient.employeeId}`,
        date: '',
      },
      {
        label: 'Issued by (Supply Officer)',
        name: fullName(issuer.firstName, issuer.lastName),
        role: `${roleDisplay(issuer.role)} / ${issuer.employeeId}`,
        date: '',
      },
      {
        label: 'Approved by',
        name: '___________________________',
        role: 'Division Head / Authorized Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
