import {
  buildRequisitionPrint,
  type RequisitionPrintInput,
} from './requisition-print';

// What the paper copy of a requisition says: its state in plain words, each step so far, who must sign.

const user = (
  first: string,
  last: string,
  over: Record<string, string> = {},
) => ({
  firstName: first,
  lastName: last,
  employeeId: 'SBX-EMP',
  role: 'employee',
  division: 'Operations',
  officeOrSection: 'Field Operations',
  ...over,
});

const base = (): RequisitionPrintInput => ({
  requisition: {
    id: 'r-1',
    requestNumber: 'REQ-2026-0054',
    requisitionType: 'new',
    status: 'pending_supervisor',
    justification: 'A new laptop for the field data encoder.',
    requiredDate: new Date('2026-10-28T00:00:00Z'),
    createdAt: new Date('2026-10-18T06:30:00Z'),
    submittedAt: new Date('2026-10-18T06:30:00Z'),
    updatedAt: new Date('2026-10-18T06:30:00Z'),
    supervisorDecision: null,
    supervisorComments: null,
    supervisorDecidedAt: null,
    fulfilledAt: null,
    fulfillmentNotes: null,
    items: [
      {
        quantity: 1,
        assetType: 'ICT',
        assetClass: 'SEP',
        itemDescription: 'Lenovo ThinkPad T14 Laptop',
      },
    ],
  },
  requester: user('Juan', 'dela Cruz'),
  approver: user('Maria', 'Santos', {
    role: 'supervisor',
    employeeId: 'SBX-SUP',
  }),
  fulfiller: null,
  holds: [],
  replacedAsset: null,
});

describe('buildRequisitionPrint', () => {
  it('identifies the record and says where it stands in plain words', () => {
    const rec = buildRequisitionPrint(base());

    expect(rec.kind).toBe('requisition');
    expect(rec.recordId).toBe('r-1');
    expect(rec.title).toBe('REQUISITION RECORD');
    expect(rec.reference).toBe('REQ-2026-0054');
    expect(rec.status).toBe('Waiting for the approving officer');
    expect(rec.nextStep).toContain('approving officer');
  });

  it.each([
    ['pending_fulfillment', 'Approved, waiting for the custodian'],
    ['on_hold', 'On hold: the item is not in stock'],
    ['fulfilled', 'Fulfilled: the item was issued'],
    ['rejected', 'Rejected'],
    ['cancelled', 'Cancelled by the requester'],
  ])('describes %s as "%s"', (status, words) => {
    const input = base();
    input.requisition.status = status;

    expect(buildRequisitionPrint(input).status).toBe(words);
  });

  it('names the requester, the office, the dates and the approving officer', () => {
    const facts = Object.fromEntries(
      buildRequisitionPrint(base()).facts.map((f) => [f.label, f.value]),
    );

    expect(facts['Requested by']).toBe(
      'Juan dela Cruz (SBX-EMP), Operations / Field Operations',
    );
    expect(facts['Date filed']).toBe('10/18/2026');
    expect(facts['Needed by']).toBe('10/28/2026');
    expect(facts['Approving officer']).toBe('Maria Santos');
    expect(facts['Type']).toBe('New item');
  });

  it('says so when no approving officer is assigned yet', () => {
    const input = base();
    input.approver = null;

    expect(
      buildRequisitionPrint(input).facts.find(
        (f) => f.label === 'Approving officer',
      )?.value,
    ).toBe('Not yet assigned');
  });

  it('lists the items and gives the reason', () => {
    const rec = buildRequisitionPrint(base());

    expect(rec.table?.rows).toEqual([
      ['1', 'Lenovo ThinkPad T14 Laptop', 'ICT, SEP'],
    ]);
    expect(rec.notes).toEqual([
      { label: 'Reason', value: 'A new laptop for the field data encoder.' },
    ]);
  });

  it('shows the item a replacement replaces', () => {
    const input = base();
    input.requisition.requisitionType = 'replacement';
    input.replacedAsset = {
      itemDescription: 'Dell Latitude 5440 Laptop',
      propertyNumber: 'DEMO-ICT-0002',
    };

    const facts = Object.fromEntries(
      buildRequisitionPrint(input).facts.map((f) => [f.label, f.value]),
    );

    expect(facts['Type']).toBe('Replacement');
    expect(facts['Replaces']).toBe('Dell Latitude 5440 Laptop (DEMO-ICT-0002)');
  });

  it('starts the history with the filing', () => {
    const [filed] = buildRequisitionPrint(base()).events;

    expect(filed).toEqual({
      at: new Date('2026-10-18T06:30:00Z'),
      what: 'Filed',
      by: 'Juan dela Cruz',
    });
  });

  it("records an approval with the officer's comment", () => {
    const input = base();
    input.requisition.status = 'pending_fulfillment';
    input.requisition.supervisorDecision = 'approved';
    input.requisition.supervisorComments = 'Needed for the new encoder.';
    input.requisition.supervisorDecidedAt = new Date('2026-10-18T07:10:00Z');

    const events = buildRequisitionPrint(input).events;

    expect(events[1]).toEqual({
      at: new Date('2026-10-18T07:10:00Z'),
      what: 'Approved: "Needed for the new encoder."',
      by: 'Maria Santos',
    });
  });

  it('records a rejection with the reason', () => {
    const input = base();
    input.requisition.status = 'rejected';
    input.requisition.supervisorDecision = 'rejected';
    input.requisition.supervisorComments = 'Not within budget.';
    input.requisition.supervisorDecidedAt = new Date('2026-10-18T07:10:00Z');

    expect(buildRequisitionPrint(input).events[1].what).toBe(
      'Rejected: "Not within budget."',
    );
  });

  it('keeps every time it was put on hold, even after it was fulfilled', () => {
    const input = base();
    input.requisition.status = 'fulfilled';
    input.requisition.supervisorDecision = 'approved';
    input.requisition.supervisorDecidedAt = new Date('2026-10-18T07:10:00Z');
    input.requisition.fulfilledAt = new Date('2026-10-19T02:00:00Z');
    input.requisition.fulfillmentNotes = 'Issued laptop UAT-ICT-0001.';
    input.fulfiller = user('Ian', 'Torres', { role: 'it_personnel' });
    input.holds = [{ at: new Date('2026-10-18T08:00:00Z'), by: 'Ian Torres' }];

    const what = buildRequisitionPrint(input).events.map((e) => e.what);

    expect(what).toEqual([
      'Filed',
      'Approved',
      'Put on hold: the item was not in stock',
      'Fulfilled and issued: "Issued laptop UAT-ICT-0001."',
    ]);
  });

  it('adds the custodian as a signer once the requisition has reached the custodian', () => {
    const input = base();
    input.requisition.status = 'fulfilled';
    input.fulfiller = user('Ian', 'Torres', { role: 'it_personnel' });

    const signers = buildRequisitionPrint(input).signatories;

    expect(signers.map((s) => s.label)).toEqual([
      'Requester',
      'Approving Officer',
      'Custodian',
    ]);
    expect(signers[2].name).toBe('Ian Torres');
  });

  it('asks only for the requester and the approving officer while it waits for approval', () => {
    expect(
      buildRequisitionPrint(base()).signatories.map((s) => s.label),
    ).toEqual(['Requester', 'Approving Officer']);
  });
});
