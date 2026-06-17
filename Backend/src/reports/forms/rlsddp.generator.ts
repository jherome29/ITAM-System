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

// SVC: Deliver and Support — RLSDDP for lost/stolen/damaged/destroyed property (Appendix 75)

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
}

interface UserLike {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export async function generateRLSSDDP(
  asset: AssetLike,
  officer: UserLike,
  lossType: 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed',
  circumstances: string,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  const rlsNo = `RLSDDP-${Date.now()}`;
  y = drawFormTitle(
    doc,
    'REPORT OF LOST, STOLEN, DAMAGED OR DESTROYED PROPERTY',
    'Appendix',
    '75',
    y,
  );

  y = drawMetaFields(
    doc,
    [
      { label: 'RLSDDP No.', value: rlsNo },
      { label: 'Date', value: today() },
      { label: 'PAR No.', value: asset.propertyNumber ?? '_______________' },
      { label: 'PAR Date', value: fmtDate(asset.acquisitionDate) },
      {
        label: 'Entity Name',
        value: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
      },
      { label: 'Fund Cluster', value: 'General Fund' },
      { label: 'Department/Office', value: officer.officeOrSection },
      {
        label: 'Accountable Officer',
        value: fullName(officer.firstName, officer.lastName),
      },
    ],
    y,
  );

  // Status of property
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
  doc.text('Status of Property:', PAGE.margin, y);
  const statuses: ('Lost' | 'Stolen' | 'Damaged' | 'Destroyed')[] = [
    'Lost',
    'Stolen',
    'Damaged',
    'Destroyed',
  ];
  let sx = PAGE.margin + 110;
  for (const s of statuses) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(`[${s === lossType ? 'x' : ' '}] ${s}`, sx, y);
    sx += 80;
  }
  y += 14;

  y = drawTable(
    doc,
    [
      { header: 'PROPERTY NO.', width: 110 },
      { header: 'DESCRIPTION', width: 165 },
      { header: 'DATE ACQUIRED', width: 80 },
      { header: 'ACQUISITION COST', width: 80 },
      { header: 'CONDITION', width: 80 },
    ],
    [
      [
        asset.propertyNumber ?? '—',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}${asset.serialNumber ? '\nS/N: ' + asset.serialNumber : ''}`,
        fmtDate(asset.acquisitionDate),
        phpFormat(asset.acquisitionCost),
        asset.condition,
      ],
    ],
    y,
  );

  y += 8;
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#000000')
    .text('Circumstances:', PAGE.margin, y);
  y += 12;
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(circumstances || '_______________', PAGE.margin, y, {
      width: CONTENT_WIDTH,
    });
  y += Math.max(24, Math.ceil(circumstances.length / 90) * 12 + 8);

  doc.font('Helvetica').fontSize(7.5);
  doc.text(
    'I hereby certify that the above loss/damage is true and correct and that the same occurred without negligence on my part.',
    PAGE.margin,
    y,
    { width: CONTENT_WIDTH, align: 'justify' },
  );
  y += 24;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Accountable Officer',
        name: fullName(officer.firstName, officer.lastName),
        role: `${roleDisplay(officer.role)} / ${officer.employeeId}`,
        date: '',
      },
      {
        label: 'Immediate Supervisor',
        name: '___________________________',
        role: 'Division Supervisor',
        date: '',
      },
      {
        label: 'Head, Property Division',
        name: '___________________________',
        role: 'Authorized Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
