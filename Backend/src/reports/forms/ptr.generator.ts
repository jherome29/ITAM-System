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

// SVC: Deliver and Support — PTR generated when IT Personnel records an asset transfer (Appendix 76)

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

interface UserLike {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export async function generatePTR(
  asset: AssetLike,
  releasingOfficer: UserLike,
  targetOffice: string,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  const ptrNo = `PTR-${Date.now()}`;
  y = drawFormTitle(doc, 'PROPERTY TRANSFER REPORT', 'PTR No.', ptrNo, y);

  y = drawMetaFields(
    doc,
    [
      {
        label: 'Entity Name',
        value: 'CYBERCRIME INVESTIGATION AND COORDINATING CENTER',
      },
      { label: 'Fund Cluster', value: 'General Fund' },
      { label: 'Date', value: today() },
      { label: 'Transfer Type', value: 'Within Agency — Office to Office' },
    ],
    y,
  );

  // From / To section
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
  doc.text('Reason for Transfer:', PAGE.margin, y);
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(
      'Asset relocation per operational requirement',
      PAGE.margin + 110,
      y,
      { width: CONTENT_WIDTH - 110 },
    );
  y += 14;

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('From:', PAGE.margin, y, { continued: true });
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(
      `  ${asset.division ?? ''} / ${asset.officeOrSection ?? ''} (${asset.accountableOfficer ?? 'Accountable Officer'})`,
      { width: CONTENT_WIDTH - 30 },
    );
  y += 13;

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('To:', PAGE.margin, y, { continued: true });
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(`  ${targetOffice}`, { width: CONTENT_WIDTH - 20 });
  y += 16;

  y = drawTable(
    doc,
    [
      { header: 'PROPERTY NO.', width: 110 },
      { header: 'DATE ACQUIRED', width: 80 },
      { header: 'DESCRIPTION', width: 175 },
      { header: 'QTY', width: 30 },
      { header: 'UNIT COST', width: 80 },
      { header: 'CONDITION', width: 40 },
    ],
    [
      [
        asset.propertyNumber ?? '—',
        fmtDate(asset.acquisitionDate),
        `${asset.itemDescription}${asset.brand ? ' / ' + asset.brand : ''}`,
        '1',
        phpFormat(asset.acquisitionCost),
        asset.condition ?? '—',
      ],
    ],
    y,
  );

  y += 8;

  drawSignatureBlock(
    doc,
    [
      {
        label: 'Released/Issued by',
        name: fullName(releasingOfficer.firstName, releasingOfficer.lastName),
        role: `${roleDisplay(releasingOfficer.role)} / ${releasingOfficer.employeeId}`,
        date: '',
      },
      {
        label: 'Received by',
        name: '___________________________',
        role: 'Receiving Officer',
        date: '',
      },
      {
        label: 'Approved by',
        name: '___________________________',
        role: 'Authorized Official',
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
