import { formatPrintDate, type PrintableRecord } from '../reports/record-print';

// The paper copy of a return or incident request: what was reported, what the custodian decided, what came of it.
// SVC: Deliver and Support - proof that an item was handed back, or that a loss or damage was reported.

interface UserLite {
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export interface AssetRequestPrintInput {
  request: {
    id: string;
    requestNumber: string;
    type: string;
    status: string;
    preferredDate: string;
    details: string;
    handoverDate: string | null;
    decidedAt: Date | null;
    decisionNotes: string | null;
    completedAt: Date | null;
    completionNotes: string | null;
    resultingStatus: string | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  asset: {
    propertyNumber: string | null;
    itemDescription: string;
    serialNumber: string | null;
  };
  requester: UserLite | null;
  decider: UserLite | null;
  completer: UserLite | null;
}

const KIND_WORDS: Record<string, string> = {
  return: 'Return',
  repair: 'Repair request',
  damage: 'Damage report',
  loss: 'Loss report',
  theft: 'Theft report',
};

const name = (u: UserLite | null) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : '';
const quoted = (text: string | null) =>
  text && text.trim() ? `: "${text.trim()}"` : '';
const human = (value: string) => value.replaceAll('_', ' ');

export function buildAssetRequestPrint(
  input: AssetRequestPrintInput,
): PrintableRecord {
  const { request: r, asset, requester, decider, completer } = input;
  const requesterName = name(requester) || 'Unknown';
  const isIncident = r.type === 'loss' || r.type === 'theft';
  const handover = r.handoverDate
    ? formatPrintDate(new Date(r.handoverDate))
    : '';

  const status =
    r.status === 'submitted'
      ? 'Waiting for the custodian'
      : r.status === 'approved'
        ? `Approved: bring the item in${handover ? ` on ${handover}` : ''}`
        : r.status === 'completed'
          ? 'Completed: the item was received'
          : r.status === 'rejected'
            ? 'Rejected'
            : r.status === 'cancelled'
              ? 'Cancelled by the requester'
              : r.status;

  const facts = [
    { label: 'Kind', value: KIND_WORDS[r.type] ?? r.type },
    {
      label: 'Filed by',
      value: requester
        ? `${requesterName} (${requester.employeeId}), ${requester.division} / ${requester.officeOrSection}`
        : requesterName,
    },
    { label: 'Date filed', value: formatPrintDate(r.createdAt) },
    {
      label: r.type === 'return' ? 'Preferred hand-over date' : 'Date observed',
      value: formatPrintDate(new Date(r.preferredDate)),
    },
  ];
  if (handover) facts.push({ label: 'Hand-over date', value: handover });

  const events: PrintableRecord['events'] = [
    { at: r.createdAt, what: 'Filed', by: requesterName },
  ];
  if (r.decidedAt) {
    events.push({
      at: r.decidedAt,
      what: `${r.status === 'rejected' ? 'Rejected' : 'Approved'}${quoted(r.decisionNotes)}`,
      by: name(decider) || 'Custodian',
    });
  }
  if (r.completedAt) {
    const result = r.resultingStatus
      ? `: asset is now ${human(r.resultingStatus)}`
      : '';
    events.push({
      at: r.completedAt,
      what: `Item received and the request completed${result}${quoted(r.completionNotes)}`,
      by: name(completer) || 'Custodian',
    });
  }
  if (r.cancelledAt)
    events.push({ at: r.cancelledAt, what: 'Cancelled', by: requesterName });

  const nextStep =
    r.status === 'submitted'
      ? 'The custodian approves or rejects the request and sets the hand-over date.'
      : r.status === 'approved'
        ? isIncident
          ? 'The requester prepares the supporting documents; the custodian completes the report.'
          : 'The requester brings the item in; the custodian marks it received.'
        : r.status === 'rejected'
          ? 'The requester may file a new request.'
          : undefined;

  return {
    kind: 'asset_request',
    recordId: r.id,
    title: 'RETURN / INCIDENT RECORD',
    reference: r.requestNumber,
    status,
    facts,
    table: {
      title: 'ASSET CONCERNED',
      columns: [
        { header: 'PROPERTY NO.', width: 130 },
        { header: 'DESCRIPTION', width: 250 },
        { header: 'SERIAL NO.', width: 135 },
      ],
      rows: [
        [
          asset.propertyNumber ?? '-',
          asset.itemDescription,
          asset.serialNumber ?? '-',
        ],
      ],
    },
    notes: [{ label: 'What was reported', value: r.details }],
    events,
    nextStep,
    signatories: [
      { label: 'Holder (requester)', name: requesterName, role: 'Employee' },
      {
        label: 'Custodian',
        name: name(completer) || name(decider),
        role: 'Custodian',
      },
    ],
  };
}
