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

// SVC: Deliver and Support — Receipt of Returned Semi-Expendable Property (Annex A.6)

interface AssetLike {
  propertyNumber: string | null;
  itemDescription: string;
  brand: string | null;
  serialNumber: string | null;
  officeOrSection: string | null;
}

interface UserLike {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  officeOrSection: string;
}

export async function generateReceiptReturnedSEP(
  asset: AssetLike,
  returnee: UserLike,
  receiver: UserLike,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  const rrspNo = `RRSP-${Date.now()}`;
  y = drawFormTitle(
    doc,
    'RECEIPT OF RETURNED SEMI-EXPENDABLE PROPERTY',
    'Annex',
    'A.6',
    y,
  );

  y = drawMetaFields(
    doc,
    [
      {
        label: 'Entity Name',
        value: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
      },
      { label: 'RRSP No.', value: rrspNo },
      { label: 'Date', value: today() },
      { label: 'Office/Section', value: returnee.officeOrSection },
    ],
    y,
  );

  y += 4;

  const icsNo = `ICS-${asset.propertyNumber ?? '—'}`;

  y = drawTable(
    doc,
    [
      { header: 'ICS NO.', width: 110 },
      { header: 'ITEM DESCRIPTION', width: 195 },
      { header: 'QTY', width: 40 },
      { header: 'END-USER', width: 110 },
      { header: 'REMARKS', width: 60 },
    ],
    [
      [
        icsNo,
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}${asset.serialNumber ? '\nS/N: ' + asset.serialNumber : ''}`,
        '1',
        fullName(returnee.firstName, returnee.lastName),
        '',
      ],
    ],
    y,
  );

  y += 12;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Returned by',
        name: fullName(returnee.firstName, returnee.lastName),
        role: `${roleDisplay(returnee.role)} / ${returnee.employeeId}`,
        date: '',
      },
      {
        label: 'Received by',
        name: fullName(receiver.firstName, receiver.lastName),
        role: `${roleDisplay(receiver.role)} / ${receiver.employeeId}`,
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
