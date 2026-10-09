import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  requesterLabel,
  requisitionStatusLabel,
  requisitionTimeline,
  slaBadge,
} from '@/lib/requisitions/requisition-view';

describe('requisitionStatusLabel', () => {
  it('turns status codes into plain words', () => {
    expect(requisitionStatusLabel('pending_supervisor')).toBe('Awaiting approval');
    expect(requisitionStatusLabel('pending_fulfillment')).toBe('Approved — awaiting fulfillment');
    expect(requisitionStatusLabel('on_hold')).toBe('On hold');
    expect(requisitionStatusLabel('fulfilled')).toBe('Fulfilled');
    expect(requisitionStatusLabel('rejected')).toBe('Rejected');
  });

  it('falls back to a readable form for unknown codes', () => {
    expect(requisitionStatusLabel('some_new_state')).toBe('Some new state');
  });
});

describe('formatDate / formatDateTime (Philippine time)', () => {
  it('formats a date-only value without shifting the day', () => {
    expect(formatDate('2026-10-14')).toBe('Oct 14, 2026');
  });

  it('formats a UTC timestamp in Asia/Manila', () => {
    // 15:20 UTC = 11:20 PM in Manila (UTC+8)
    expect(formatDateTime('2026-10-07T15:20:10.426Z')).toBe('Oct 7, 2026, 11:20 PM');
  });

  it('shows a dash for missing values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });
});

describe('slaBadge', () => {
  const now = new Date('2026-10-08T00:00:00Z');

  it('is only shown while awaiting approval', () => {
    expect(slaBadge({ status: 'fulfilled', slaDeadline: '2026-10-07T00:00:00Z' }, now)).toBeNull();
  });

  it('is red once the deadline has passed', () => {
    expect(slaBadge({ status: 'pending_supervisor', slaDeadline: '2026-10-07T21:00:00Z' }, now)).toEqual({ label: 'Overdue by 3h', tone: 'red' });
  });

  it('is amber when 6 hours or less remain', () => {
    expect(slaBadge({ status: 'pending_supervisor', slaDeadline: '2026-10-08T05:00:00Z' }, now)).toEqual({ label: 'Due in 5h', tone: 'amber' });
  });

  it('is neutral with plenty of time left', () => {
    expect(slaBadge({ status: 'pending_supervisor', slaDeadline: '2026-10-08T20:00:00Z' }, now)).toEqual({ label: 'Due in 20h', tone: 'slate' });
  });

  it('says "under 1h" instead of "0h"', () => {
    expect(slaBadge({ status: 'pending_supervisor', slaDeadline: '2026-10-08T00:20:00Z' }, now)).toEqual({ label: 'Due in under 1h', tone: 'amber' });
  });
});

describe('requesterLabel', () => {
  it('joins name, employee ID and section', () => {
    expect(requesterLabel({ id: 'u1', name: 'Juan Dela Cruz', employeeId: 'CICC-EMP-001', officeOrSection: 'Cybercrime Operations' })).toBe('Juan Dela Cruz · CICC-EMP-001 · Cybercrime Operations');
  });

  it('handles a missing requester', () => {
    expect(requesterLabel(null)).toBe('Unknown requester');
  });
});

describe('requisitionTimeline', () => {
  const base = { status: 'pending_supervisor', submittedAt: '2026-10-07T15:20:00Z', supervisorDecision: null, supervisorDecidedAt: null, supervisorComments: null, fulfilledAt: null, fulfillmentNotes: null, alternateRoutedAt: null, approver: null };

  it('starts with the submission', () => {
    expect(requisitionTimeline(base).map((s) => s.label)).toEqual(['Submitted for approval']);
  });

  it('names the approver and carries their remarks', () => {
    const steps = requisitionTimeline({ ...base, status: 'pending_fulfillment', supervisorDecision: 'approved', supervisorDecidedAt: '2026-10-07T16:00:00Z', supervisorComments: 'OK for case work', approver: { id: 's', name: 'Maria Santos', employeeId: 'CICC-SUP-001' } });
    expect(steps[1]).toMatchObject({ label: 'Approved by Maria Santos', note: 'OK for case work' });
  });

  it('records rejection, hold and fulfilment', () => {
    expect(requisitionTimeline({ ...base, status: 'rejected', supervisorDecision: 'rejected', supervisorDecidedAt: '2026-10-07T16:00:00Z', supervisorComments: 'Use spare' })[1]).toMatchObject({ label: 'Rejected by approving officer', note: 'Use spare' });
    expect(requisitionTimeline({ ...base, status: 'on_hold', supervisorDecision: 'approved', supervisorDecidedAt: '2026-10-07T16:00:00Z', fulfillmentNotes: 'Awaiting stock' }).at(-1)).toMatchObject({ label: 'Put on hold by custodian', note: 'Awaiting stock' });
    expect(requisitionTimeline({ ...base, status: 'fulfilled', supervisorDecision: 'approved', supervisorDecidedAt: '2026-10-07T16:00:00Z', fulfilledAt: '2026-10-08T01:00:00Z' }).at(-1)).toMatchObject({ label: 'Fulfilled by custodian' });
  });
});
