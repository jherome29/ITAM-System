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
  PAGE,
  CONTENT_WIDTH,
} from './base-form.generator';

// SVC: Obtain/Build — IAR generated when newly procured assets are received and inspected (Appendix 62)

interface AssetLike {
  propertyNumber: string | null;
  itemDescription: string;
  brand: string | null;
  serialNumber: string | null;
  acquisitionCost: number;
  acquisitionDate: Date | string | null;
  dateOfDelivery: Date | string | null;
  supplier: string | null;
  condition: string;
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

export async function generateIAR(
  asset: AssetLike,
  inspector: UserLike,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  const iarNo = `IAR-${Date.now()}`;
  y = drawFormTitle(
    doc,
    'INSPECTION AND ACCEPTANCE REPORT',
    'IAR No.',
    iarNo,
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
      { label: 'Date Received', value: fmtDate(asset.dateOfDelivery) },
      { label: 'Supplier', value: asset.supplier ?? '_______________' },
      {
        label: 'Requisitioning Office',
        value: asset.officeOrSection ?? '_______________',
      },
    ],
    y,
  );

  y += 4;

  // Inspection section
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
  doc.text('INSPECTION', PAGE.margin, y);
  y += 12;
  doc.font('Helvetica').fontSize(8);
  doc.text(
    'The property described below was inspected and found to be in good order and conformity with specifications.',
    PAGE.margin,
    y,
    { width: CONTENT_WIDTH },
  );
  y += 16;

  y = drawTable(
    doc,
    [
      { header: 'QTY', width: 35 },
      { header: 'UNIT', width: 40 },
      { header: 'PROPERTY NO.', width: 100 },
      { header: 'DESCRIPTION', width: 180 },
      { header: 'UNIT COST', width: 80 },
      { header: 'REMARKS', width: 80 },
    ],
    [
      [
        '1',
        'unit',
        asset.propertyNumber ?? '—',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}${asset.serialNumber ? '\nS/N: ' + asset.serialNumber : ''}`,
        phpFormat(asset.acquisitionCost),
        asset.condition,
      ],
    ],
    y,
  );

  y += 8;

  // Acceptance section
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#000000')
    .text('ACCEPTANCE', PAGE.margin, y);
  y += 12;
  doc.font('Helvetica').fontSize(8);
  doc.text(
    'The property/equipment described above was accepted in good condition and in conformity with specifications.',
    PAGE.margin,
    y,
    { width: CONTENT_WIDTH },
  );
  y += 20;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Inspecting Officer',
        name: fullName(inspector.firstName, inspector.lastName),
        role: `${roleDisplay(inspector.role)} / ${inspector.employeeId}`,
        date: '',
      },
      {
        label: 'Accountable Officer',
        name: '___________________________',
        role: 'Property Custodian',
        date: '',
      },
      {
        label: 'Authorized Official',
        name: '___________________________',
        role: 'Division Head',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
