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
  PAGE,
  CONTENT_WIDTH,
} from './base-form.generator';

// SVC: Deliver and Support — RIS generated when a requisition is fulfilled by IT Personnel

interface RequisitionItemLike {
  itemDescription: string;
  assetType: string;
  quantity: number;
  fulfilledAssetId: string | null;
}

interface RequisitionLike {
  requestNumber: string;
  justification: string;
  requisitionType: string;
  items: RequisitionItemLike[];
}

interface UserLike {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export async function generateRIS(
  req: RequisitionLike,
  requester: UserLike,
  supervisor: UserLike | null,
  issuer: UserLike,
): Promise<Buffer> {
  const doc = createDoc();
  let y = drawRepublicHeader(doc);

  y = drawFormTitle(
    doc,
    'REQUISITION AND ISSUE SLIP',
    'RIS No.',
    req.requestNumber,
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
      { label: 'Division', value: requester.division },
      { label: 'Office/Section', value: requester.officeOrSection },
      { label: 'Date', value: today() },
      { label: '', value: '' },
    ],
    y,
  );

  y += 4;

  const rows = req.items.map((item, i) => [
    String(i + 1).padStart(3, '0'),
    'unit',
    item.itemDescription,
    String(item.quantity),
    String(item.quantity),
    item.fulfilledAssetId ? 'Yes' : '—',
  ]);

  y = drawTable(
    doc,
    [
      { header: 'STOCK NO.', width: 55 },
      { header: 'UNIT', width: 40 },
      { header: 'DESCRIPTION', width: 225 },
      { header: 'QTY\nREQUESTED', width: 55 },
      { header: 'QTY\nISSUED', width: 55 },
      { header: 'STOCK\nAVAIL.', width: 45 },
    ],
    rows,
    y,
  );

  y += 8;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
  doc.text('Purpose:', PAGE.margin, y, { continued: true });
  doc
    .font('Helvetica')
    .text(` ${req.justification}`, { width: CONTENT_WIDTH - 50 });
  y += Math.max(16, Math.ceil(req.justification.length / 100) * 11 + 8);

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
        label: 'Approved by',
        name: supervisor
          ? fullName(supervisor.firstName, supervisor.lastName)
          : '___________________________',
        role: supervisor
          ? `${roleDisplay(supervisor.role)} / ${supervisor.employeeId}`
          : 'Division Supervisor',
        date: '',
      },
      {
        label: 'Issued by',
        name: fullName(issuer.firstName, issuer.lastName),
        role: `${roleDisplay(issuer.role)} / ${issuer.employeeId}`,
        date: '',
      },
      {
        label: 'Received by',
        name: fullName(requester.firstName, requester.lastName),
        role: `${roleDisplay(requester.role)} / ${requester.employeeId}`,
        date: '',
      },
    ],
    y,
  );

  return bufferize(doc);
}
