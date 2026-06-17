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

// SVC: Deliver and Support — IIRUP for flagging unserviceable assets (Appendix 74)

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

export async function generateIIRUP(
  asset: AssetLike,
  inspector: UserLike,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE PROPERTY',
    'Appendix',
    '74',
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
      { label: 'As at', value: today() },
      {
        label: 'Division/Office',
        value: `${asset.division ?? ''} / ${asset.officeOrSection ?? ''}`,
      },
    ],
    y,
  );

  y += 4;

  y = drawTable(
    doc,
    [
      { header: 'QTY', width: 30 },
      { header: 'UNIT', width: 35 },
      { header: 'PROPERTY NO.', width: 95 },
      { header: 'DESCRIPTION', width: 130 },
      { header: 'DATE ACQUIRED', width: 75 },
      { header: 'ACQUISITION COST', width: 75 },
      { header: 'CONDITION', width: 55 },
      { header: 'RECOMMENDED\nACTION', width: 70 },
    ],
    [
      [
        '1',
        'unit',
        asset.propertyNumber ?? '—',
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}${asset.serialNumber ? '\nS/N: ' + asset.serialNumber : ''}`,
        fmtDate(asset.acquisitionDate),
        phpFormat(asset.acquisitionCost),
        asset.condition,
        'For Disposal',
      ],
    ],
    y,
  );

  y += 8;
  doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
  doc.text(
    'I hereby certify that the property/ies described above are no longer serviceable and unfit for further use.',
    PAGE.margin,
    y,
    { width: CONTENT_WIDTH, align: 'justify' },
  );
  y += 18;

  // Record of Sales / Remarks section
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Record of Sales / Disposal Recommendation:', PAGE.margin, y);
  y += 10;
  doc
    .moveTo(PAGE.margin, y + 12)
    .lineTo(PAGE.width - PAGE.margin, y + 12)
    .strokeColor('#888888')
    .lineWidth(0.5)
    .stroke();
  y += 20;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Inspection Officer',
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
        role: 'Division Head / Admin Officer',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
