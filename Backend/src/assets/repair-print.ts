import { formatPrintDate, type PrintableRecord } from '../reports/record-print';

// The paper copy of a repair: the item, where it went, the spare unit lent, and how it ended.
// SVC: Deliver and Support - proof of what was sent for repair and what came back.

interface UserLite {
  firstName: string;
  lastName: string;
  employeeId: string;
}

export interface RepairPrintInput {
  repair: {
    id: string;
    serviceType: string;
    serviceProvider: string | null;
    reportedProblem: string | null;
    expectedCompletionDate: string | null;
    findings: string | null;
    actionTaken: string | null;
    outcome: string | null;
    openedAt: Date;
    completedAt: Date | null;
  };
  asset: {
    propertyNumber: string | null;
    itemDescription: string;
    serialNumber: string | null;
  };
  holder: UserLite | null;
  loaner: { propertyNumber: string | null; itemDescription: string } | null;
  openedBy: UserLite | null;
  completedBy: UserLite | null;
}

const name = (u: UserLite | null) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : '';
const quoted = (text: string | null) =>
  text && text.trim() ? `: "${text.trim()}"` : '';

export function buildRepairPrint(input: RepairPrintInput): PrintableRecord {
  const { repair: r, asset, holder, loaner, openedBy, completedBy } = input;
  const external = r.serviceType === 'external';

  const status = !r.completedAt
    ? 'Under repair'
    : r.outcome === 'unrepairable'
      ? 'Closed: cannot be repaired'
      : 'Closed: repaired';

  const facts = [
    {
      label: 'Held by',
      value: holder ? `${name(holder)} (${holder.employeeId})` : 'In stock',
    },
    {
      label: 'Repaired',
      value: external
        ? `Outside${r.serviceProvider ? `: ${r.serviceProvider}` : ''}`
        : 'In-house',
    },
    { label: 'Opened', value: formatPrintDate(r.openedAt) },
    {
      label: 'Due back',
      value: r.expectedCompletionDate
        ? formatPrintDate(new Date(r.expectedCompletionDate))
        : 'Not set',
    },
    {
      label: 'Spare unit lent',
      value: loaner
        ? loaner.propertyNumber
          ? `${loaner.itemDescription} (${loaner.propertyNumber})`
          : loaner.itemDescription
        : 'None',
    },
  ];

  const notes = [
    { label: 'Reported problem', value: r.reportedProblem ?? 'Not recorded' },
  ];
  if (r.findings) notes.push({ label: 'Findings', value: r.findings });
  if (r.actionTaken) notes.push({ label: 'Work done', value: r.actionTaken });

  const events: PrintableRecord['events'] = [
    {
      at: r.openedAt,
      what: `Repair opened: repaired ${external ? 'outside' : 'in-house'}`,
      by: name(openedBy) || 'Custodian',
    },
  ];
  if (r.completedAt) {
    events.push({
      at: r.completedAt,
      what: `Repair closed as ${r.outcome === 'unrepairable' ? 'not repairable' : 'repaired'}${quoted(
        r.outcome === 'unrepairable' ? r.findings : r.actionTaken,
      )}`,
      by: name(completedBy) || 'Custodian',
    });
  }

  const nextStep = !r.completedAt
    ? 'The custodian updates the repair and closes it as repaired or not repairable.'
    : r.outcome === 'unrepairable'
      ? 'The item is flagged for disposal; its holder keeps the responsibility and may ask for a replacement.'
      : 'The item goes back to its holder, or into stock.';

  const signatories = [
    {
      label: 'Custodian',
      name: name(completedBy) || name(openedBy),
      role: 'Custodian',
    },
  ];
  if (holder)
    signatories.push({ label: 'Holder', name: name(holder), role: 'Employee' });

  return {
    kind: 'repair',
    recordId: r.id,
    title: 'REPAIR RECORD',
    reference: `RPR-${r.id.slice(0, 8).toUpperCase()}`,
    status,
    facts,
    table: {
      title: 'ITEM',
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
    notes,
    events,
    nextStep,
    signatories,
  };
}
