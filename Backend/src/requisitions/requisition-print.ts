import { formatPrintDate, type PrintableRecord } from '../reports/record-print';

// The paper copy of a requisition: its state in plain words, each step so far, and who signs.
// A plain function over plain data, so the wording is tested without a database or a PDF.
// SVC: Engage / Deliver and Support - proof of a request and of what was decided about it.

interface UserLite {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export interface RequisitionPrintInput {
  requisition: {
    id: string;
    requestNumber: string;
    requisitionType: string;
    status: string;
    justification: string;
    requiredDate: Date | string;
    createdAt: Date;
    submittedAt?: Date | null;
    updatedAt: Date;
    supervisorDecision: 'approved' | 'rejected' | null;
    supervisorComments: string | null;
    supervisorDecidedAt: Date | null;
    fulfilledAt: Date | null;
    fulfillmentNotes: string | null;
    items: {
      quantity: number;
      assetType: string;
      assetClass: string;
      itemDescription: string;
    }[];
  };
  requester: UserLite | null;
  approver: UserLite | null;
  fulfiller: UserLite | null;
  /** Each time the custodian put it on hold (from the audit trail), so a hold before fulfilment still shows. */
  holds: { at: Date; by: string }[];
  replacedAsset: {
    itemDescription: string;
    propertyNumber: string | null;
  } | null;
}

const STATUS_WORDS: Record<string, string> = {
  pending_supervisor: 'Waiting for the approving officer',
  pending_fulfillment: 'Approved, waiting for the custodian',
  on_hold: 'On hold: the item is not in stock',
  fulfilled: 'Fulfilled: the item was issued',
  rejected: 'Rejected',
  cancelled: 'Cancelled by the requester',
  draft: 'Draft',
};

const NEXT_STEP: Record<string, string> = {
  pending_supervisor:
    'The approving officer approves or rejects the requisition.',
  pending_fulfillment:
    'The custodian fulfils the requisition, or puts it on hold if the item is out of stock.',
  on_hold:
    'The custodian fulfils the requisition once the item is back in stock.',
  fulfilled:
    "No further step. The item is now listed under the requester's assigned assets.",
  rejected: 'The requester may file a new requisition.',
};

const TYPE_WORDS: Record<string, string> = {
  new: 'New item',
  replacement: 'Replacement',
  supply: 'Supply',
  repair: 'Repair',
};

const name = (u: UserLite | null) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : '';
const quoted = (text: string | null) =>
  text && text.trim() ? `: "${text.trim()}"` : '';

export function buildRequisitionPrint(
  input: RequisitionPrintInput,
): PrintableRecord {
  const {
    requisition: r,
    requester,
    approver,
    fulfiller,
    holds,
    replacedAsset,
  } = input;
  const requesterName = name(requester) || 'Unknown';

  const facts = [
    {
      label: 'Requested by',
      value: requester
        ? `${requesterName} (${requester.employeeId}), ${requester.division} / ${requester.officeOrSection}`
        : requesterName,
    },
    {
      label: 'Type',
      value: TYPE_WORDS[r.requisitionType] ?? r.requisitionType,
    },
    {
      label: 'Date filed',
      value: formatPrintDate(r.submittedAt ?? r.createdAt),
    },
    { label: 'Needed by', value: formatPrintDate(new Date(r.requiredDate)) },
    { label: 'Approving officer', value: name(approver) || 'Not yet assigned' },
  ];
  if (replacedAsset) {
    facts.push({
      label: 'Replaces',
      value: replacedAsset.propertyNumber
        ? `${replacedAsset.itemDescription} (${replacedAsset.propertyNumber})`
        : replacedAsset.itemDescription,
    });
  }

  const events: PrintableRecord['events'] = [
    { at: r.submittedAt ?? r.createdAt, what: 'Filed', by: requesterName },
  ];
  if (r.supervisorDecision && r.supervisorDecidedAt) {
    events.push({
      at: r.supervisorDecidedAt,
      what: `${r.supervisorDecision === 'approved' ? 'Approved' : 'Rejected'}${quoted(r.supervisorComments)}`,
      by: name(approver) || 'Approving officer',
    });
  }
  for (const hold of holds) {
    events.push({
      at: hold.at,
      what: 'Put on hold: the item was not in stock',
      by: hold.by,
    });
  }
  if (r.fulfilledAt) {
    events.push({
      at: r.fulfilledAt,
      what: `Fulfilled and issued${quoted(r.fulfillmentNotes)}`,
      by: name(fulfiller) || 'Custodian',
    });
  }
  if (r.status === 'cancelled') {
    events.push({ at: r.updatedAt, what: 'Cancelled', by: requesterName });
  }

  const signatories = [
    { label: 'Requester', name: requesterName, role: 'Employee' },
    {
      label: 'Approving Officer',
      name: name(approver),
      role: 'Approving Officer',
    },
  ];
  if (['pending_fulfillment', 'on_hold', 'fulfilled'].includes(r.status)) {
    signatories.push({
      label: 'Custodian',
      name: name(fulfiller),
      role: 'Custodian',
    });
  }

  return {
    kind: 'requisition',
    recordId: r.id,
    title: 'REQUISITION RECORD',
    reference: r.requestNumber,
    status: STATUS_WORDS[r.status] ?? r.status,
    facts,
    table: {
      title: 'ITEMS REQUESTED',
      columns: [
        { header: 'QTY', width: 35 },
        { header: 'DESCRIPTION', width: 330 },
        { header: 'TYPE', width: 150 },
      ],
      rows: r.items.map((i) => [
        String(i.quantity),
        i.itemDescription,
        `${i.assetType}, ${i.assetClass}`,
      ]),
    },
    notes: [{ label: 'Reason', value: r.justification }],
    events,
    nextStep: NEXT_STEP[r.status],
    signatories,
  };
}
