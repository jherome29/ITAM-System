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

// SVC: Deliver and Support — Move-Out Form when asset physically leaves a facility (SS-02)

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

export async function generateMoveOut(
  asset: AssetLike,
  requester: UserLike,
  requestingDivision: string,
  purpose: string,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  const mofNo = `SAP-MOF-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  y = drawFormTitle(doc, 'MOVE-OUT FORM', 'Form Code', `SS-02 / ${mofNo}`, y);

  y = drawMetaFields(
    doc,
    [
      { label: 'Date of Request', value: today() },
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
      { header: 'ITEM DESCRIPTION', width: 200 },
      { header: 'PROPERTY / SERIAL NO.', width: 155 },
      { header: 'PURPOSE OF OUT', width: 120 },
    ],
    [
      [
        '1',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}`,
        `${asset.propertyNumber ?? '—'}${asset.serialNumber ? ' / S/N: ' + asset.serialNumber : ''}`,
        purpose || '_______________',
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
        label: 'Guard on Duty',
        name: '___________________________',
        role: 'Security Personnel',
        date: '',
      },
    ],
    y,
  );

  y += 80;
  doc.font('Helvetica').fontSize(7).fillColor('#555555');
  doc.text(
    'Instructions: Print in Duplicate Copy (1 – Requesting Party, 1 – Supply Office). Submit copy to Guard on Duty upon exit.',
    40,
    y,
  );

  return bufferize(doc);
}
