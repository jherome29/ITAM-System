import { buildRepairPrint, type RepairPrintInput } from './repair-print';

// The paper copy of a repair: the item, where it went, the spare unit lent, and how it ended.

const person = (
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

const base = (): RepairPrintInput => ({
  repair: {
    id: 'a1b2c3d4-0000-4000-8000-000000000000',
    serviceType: 'external',
    serviceProvider: 'Megalink Service Center',
    reportedProblem: 'Loud noise and a water leak.',
    expectedCompletionDate: '2026-10-25',
    findings: null,
    actionTaken: null,
    outcome: null,
    openedAt: new Date('2026-10-18T06:30:00Z'),
    completedAt: null,
  },
  asset: {
    propertyNumber: 'DEMO-FIX-0004',
    itemDescription: 'Split-Type Air Conditioner, 2.0 HP',
    serialNumber: 'SN-FIX-4',
  },
  holder: person('Juan', 'dela Cruz'),
  loaner: null,
  openedBy: person('Pia', 'Cruz', { role: 'property_custodian' }),
  completedBy: null,
});

describe('buildRepairPrint', () => {
  it('gives the repair a short number and says it is under repair', () => {
    const rec = buildRepairPrint(base());

    expect(rec.kind).toBe('repair');
    expect(rec.title).toBe('REPAIR RECORD');
    expect(rec.reference).toBe('RPR-A1B2C3D4');
    expect(rec.status).toBe('Under repair');
  });

  it('describes who has it, where it went and when it is due back', () => {
    const facts = Object.fromEntries(
      buildRepairPrint(base()).facts.map((f) => [f.label, f.value]),
    );

    expect(facts['Held by']).toBe('Juan dela Cruz (SBX-EMP)');
    expect(facts['Repaired']).toBe('Outside: Megalink Service Center');
    expect(facts['Opened']).toBe('10/18/2026');
    expect(facts['Due back']).toBe('10/25/2026');
    expect(facts['Spare unit lent']).toBe('None');
  });

  it('says in-house when it is repaired in-house, and "In stock" when nobody holds it', () => {
    const input = base();
    input.repair.serviceType = 'in_house';
    input.repair.serviceProvider = null;
    input.holder = null;

    const facts = Object.fromEntries(
      buildRepairPrint(input).facts.map((f) => [f.label, f.value]),
    );

    expect(facts['Repaired']).toBe('In-house');
    expect(facts['Held by']).toBe('In stock');
  });

  it('names the spare unit lent to the holder', () => {
    const input = base();
    input.loaner = {
      propertyNumber: 'UAT-FIX-0001',
      itemDescription: 'Office Desk with Drawers',
    };

    expect(
      buildRepairPrint(input).facts.find((f) => f.label === 'Spare unit lent')
        ?.value,
    ).toBe('Office Desk with Drawers (UAT-FIX-0001)');
  });

  it('shows the problem reported, and the findings and work done once there are some', () => {
    const input = base();
    input.repair.findings = 'Compressor failed.';
    input.repair.actionTaken = 'Replaced the compressor.';

    expect(buildRepairPrint(input).notes.map((n) => n.label)).toEqual([
      'Reported problem',
      'Findings',
      'Work done',
    ]);
  });

  it('starts the history with the repair being opened', () => {
    expect(buildRepairPrint(base()).events[0]).toEqual({
      at: new Date('2026-10-18T06:30:00Z'),
      what: 'Repair opened: repaired outside',
      by: 'Pia Cruz',
    });
  });

  it('records a repair closed as repaired', () => {
    const input = base();
    input.repair.outcome = 'repaired';
    input.repair.completedAt = new Date('2026-10-22T03:00:00Z');
    input.repair.actionTaken = 'Replaced the compressor.';
    input.completedBy = person('Pia', 'Cruz', { role: 'property_custodian' });

    const rec = buildRepairPrint(input);

    expect(rec.status).toBe('Closed: repaired');
    expect(rec.events[1]).toEqual({
      at: new Date('2026-10-22T03:00:00Z'),
      what: 'Repair closed as repaired: "Replaced the compressor."',
      by: 'Pia Cruz',
    });
    expect(rec.nextStep).toContain('back to its holder');
  });

  it('records a repair that could not be repaired', () => {
    const input = base();
    input.repair.outcome = 'unrepairable';
    input.repair.completedAt = new Date('2026-10-22T03:00:00Z');
    input.repair.findings = 'Beyond repair.';

    const rec = buildRepairPrint(input);

    expect(rec.status).toBe('Closed: cannot be repaired');
    expect(rec.nextStep).toContain('flagged for disposal');
  });

  it('asks the custodian and, if someone holds it, the holder to sign', () => {
    expect(buildRepairPrint(base()).signatories.map((s) => s.label)).toEqual([
      'Custodian',
      'Holder',
    ]);
    const input = base();
    input.holder = null;
    expect(buildRepairPrint(input).signatories.map((s) => s.label)).toEqual([
      'Custodian',
    ]);
  });
});
