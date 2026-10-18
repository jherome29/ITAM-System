import {
  buildAssetRequestPrint,
  type AssetRequestPrintInput,
} from './asset-request-print';

// The paper copy of a return or incident request: what was reported, what the custodian decided, what came of it.

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

const base = (): AssetRequestPrintInput => ({
  request: {
    id: 'ar-1',
    requestNumber: 'AR-2026-0022',
    type: 'damage',
    status: 'submitted',
    preferredDate: '2026-10-17',
    details: 'The air conditioner makes a loud noise and leaks water.',
    handoverDate: null,
    decidedAt: null,
    decisionNotes: null,
    completedAt: null,
    completionNotes: null,
    resultingStatus: null,
    cancelledAt: null,
    createdAt: new Date('2026-10-18T06:30:00Z'),
    updatedAt: new Date('2026-10-18T06:30:00Z'),
  },
  asset: {
    propertyNumber: 'DEMO-FIX-0004',
    itemDescription: 'Split-Type Air Conditioner, 2.0 HP',
    serialNumber: 'SN-FIX-4',
  },
  requester: user('Juan', 'dela Cruz'),
  decider: null,
  completer: null,
});

describe('buildAssetRequestPrint', () => {
  it('identifies the report and says where it stands', () => {
    const rec = buildAssetRequestPrint(base());

    expect(rec.kind).toBe('asset_request');
    expect(rec.title).toBe('RETURN / INCIDENT RECORD');
    expect(rec.reference).toBe('AR-2026-0022');
    expect(rec.status).toBe('Waiting for the custodian');
  });

  it.each([
    ['return', 'Return'],
    ['repair', 'Repair request'],
    ['damage', 'Damage report'],
    ['loss', 'Loss report'],
    ['theft', 'Theft report'],
  ])('calls a %s "%s"', (type, words) => {
    const input = base();
    input.request.type = type;

    expect(
      buildAssetRequestPrint(input).facts.find((f) => f.label === 'Kind')
        ?.value,
    ).toBe(words);
  });

  it('names the holder, the asset and the dates', () => {
    const facts = Object.fromEntries(
      buildAssetRequestPrint(base()).facts.map((f) => [f.label, f.value]),
    );

    expect(facts['Filed by']).toBe(
      'Juan dela Cruz (SBX-EMP), Operations / Field Operations',
    );
    expect(facts['Date filed']).toBe('10/18/2026');
    expect(facts['Date observed']).toBe('10/17/2026');
  });

  it('labels the date as the preferred hand-over for a return', () => {
    const input = base();
    input.request.type = 'return';

    expect(
      buildAssetRequestPrint(input).facts.some(
        (f) => f.label === 'Preferred hand-over date',
      ),
    ).toBe(true);
  });

  it('shows the asset in the table and the report in the notes', () => {
    const rec = buildAssetRequestPrint(base());

    expect(rec.table?.rows).toEqual([
      ['DEMO-FIX-0004', 'Split-Type Air Conditioner, 2.0 HP', 'SN-FIX-4'],
    ]);
    expect(rec.notes[0]).toEqual({
      label: 'What was reported',
      value: 'The air conditioner makes a loud noise and leaks water.',
    });
  });

  it('records the approval with the hand-over date, and tells the holder what to do', () => {
    const input = base();
    input.request.status = 'approved';
    input.request.decidedAt = new Date('2026-10-18T07:10:00Z');
    input.request.decisionNotes = 'Bring the unit to the property office.';
    input.request.handoverDate = '2026-10-20';
    input.decider = user('Pia', 'Cruz', { role: 'property_custodian' });

    const rec = buildAssetRequestPrint(input);

    expect(rec.status).toBe('Approved: bring the item in on 10/20/2026');
    expect(rec.events[1]).toEqual({
      at: new Date('2026-10-18T07:10:00Z'),
      what: 'Approved: "Bring the unit to the property office."',
      by: 'Pia Cruz',
    });
    expect(rec.nextStep).toContain('brings the item in');
  });

  it('records a rejection with the reason', () => {
    const input = base();
    input.request.status = 'rejected';
    input.request.decidedAt = new Date('2026-10-18T07:10:00Z');
    input.request.decisionNotes = 'Already under warranty repair.';
    input.decider = user('Pia', 'Cruz', { role: 'property_custodian' });

    expect(buildAssetRequestPrint(input).events[1].what).toBe(
      'Rejected: "Already under warranty repair."',
    );
  });

  it('records the completion and what became of the asset', () => {
    const input = base();
    input.request.status = 'completed';
    input.request.decidedAt = new Date('2026-10-18T07:10:00Z');
    input.request.completedAt = new Date('2026-10-20T03:00:00Z');
    input.request.completionNotes = 'Compressor failed.';
    input.request.resultingStatus = 'under_repair';
    input.decider = user('Pia', 'Cruz', { role: 'property_custodian' });
    input.completer = user('Pia', 'Cruz', { role: 'property_custodian' });

    const events = buildAssetRequestPrint(input).events;

    expect(events[2]).toEqual({
      at: new Date('2026-10-20T03:00:00Z'),
      what: 'Item received and the request completed: asset is now under repair: "Compressor failed."',
      by: 'Pia Cruz',
    });
  });

  it('records a cancellation', () => {
    const input = base();
    input.request.status = 'cancelled';
    input.request.cancelledAt = new Date('2026-10-18T08:00:00Z');

    const rec = buildAssetRequestPrint(input);

    expect(rec.status).toBe('Cancelled by the requester');
    expect(rec.events[1]).toEqual({
      at: new Date('2026-10-18T08:00:00Z'),
      what: 'Cancelled',
      by: 'Juan dela Cruz',
    });
  });

  it('asks the holder and the custodian to sign', () => {
    expect(
      buildAssetRequestPrint(base()).signatories.map((s) => s.label),
    ).toEqual(['Holder (requester)', 'Custodian']);
  });
});
