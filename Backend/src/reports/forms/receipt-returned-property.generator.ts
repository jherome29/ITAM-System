import {
  createDoc,
  bufferize,
  drawRepublicHeader,
  drawFormTitle,
  drawMetaFields,
  drawTable,
  drawSignatureBlock,
  fmtDate,
  today,
  roleDisplay,
  fullName,
} from './base-form.generator';

// SVC: Deliver and Support — Receipt of Returned Property/Equipment (Annex 28)

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
  division: string;
  officeOrSection: string;
}

export async function generateReceiptReturnedProperty(
  asset: AssetLike,
  returnee: UserLike,
  receiver: UserLike,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'RECEIPT OF RETURNED PROPERTY/EQUIPMENT',
    'Annex',
    '28',
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
      {
        label: 'Property No.',
        value: asset.propertyNumber ?? '_______________',
      },
      { label: 'Date', value: today() },
      { label: 'End-user/Office', value: returnee.officeOrSection },
      { label: '', value: '' },
    ],
    y,
  );

  y += 4;

  y = drawTable(
    doc,
    [
      { header: 'QTY', width: 40 },
      { header: 'DESCRIPTION', width: 220 },
      { header: 'PROPERTY NO.', width: 110 },
      { header: 'DATE ACQUIRED', width: 80 },
      { header: 'REMARKS', width: 65 },
    ],
    [
      [
        '1',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}${asset.serialNumber ? '\nS/N: ' + asset.serialNumber : ''}`,
        asset.propertyNumber ?? '—',
        fmtDate(null),
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
