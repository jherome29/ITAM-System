import {
  createDoc,
  bufferize,
  drawRepublicHeader,
  drawFormTitle,
  drawMetaFields,
  drawTable,
  drawSignatureBlock,
  today,
  roleDisplay,
  fullName,
} from './base-form.generator';

// SVC: Deliver and Support — Move-In Form when asset is received into a facility (SS-01)

interface AssetLike {
  propertyNumber: string | null;
  itemDescription: string;
  brand: string | null;
  serialNumber: string | null;
}

interface UserLike {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export async function generateMoveIn(
  asset: AssetLike,
  requester: UserLike,
  requestingDivision: string,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(doc, 'MOVE-IN INSTRUCTIONS', 'Form Code', 'SS-01', y);

  y = drawMetaFields(
    doc,
    [
      { label: 'Date', value: today() },
      { label: 'For Supply Only: No.', value: '_______________' },
      { label: 'Requesting Division', value: requestingDivision },
      { label: 'Property Type', value: '[x] Office  [ ] Personal' },
    ],
    y,
  );

  y += 4;

  y = drawTable(
    doc,
    [
      { header: 'QTY', width: 40 },
      { header: 'ITEM DESCRIPTION', width: 220 },
      { header: 'PROPERTY / SERIAL NO.', width: 155 },
      { header: 'DATE OF MOVE-IN', width: 100 },
    ],
    [
      [
        '1',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}`,
        `${asset.propertyNumber ?? '—'}${asset.serialNumber ? ' / S/N: ' + asset.serialNumber : ''}`,
        today(),
      ],
    ],
    y,
  );

  y += 10;
  doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
  doc.text('Attachments: [ ] PAR  [ ] ICS  [ ] Others: _______________', 40, y);
  y += 20;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Requested by',
        name: fullName(requester.firstName, requester.lastName),
        role: `${roleDisplay(requester.role)} / ${requester.employeeId}`,
        date: '',
      },
      {
        label: 'Noted by',
        name: '___________________________',
        role: 'Division Supervisor',
        date: '',
      },
      {
        label: 'Received by (Supply)',
        name: '___________________________',
        role: 'Supply Officer',
        date: '',
      },
    ],
    y,
  );

  y += 80;
  doc.font('Helvetica').fontSize(7).fillColor('#555555');
  doc.text(
    'Instructions: Print in Duplicate Copy (1 – Requesting Party, 1 – Supply Office)',
    40,
    y,
  );

  return bufferize(doc);
}
