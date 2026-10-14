import { describe, expect, it } from 'vitest';
import type { Requisition } from '@/lib/api/requisitions';
import { approvalHistorySummary, decidedRequisitions, turnaroundHours } from './approval-history';

const HOUR = 3_600_000;
const t0 = Date.parse('2026-10-10T08:00:00Z');
const at = (hoursAfter: number) => new Date(t0 + hoursAfter * HOUR).toISOString();

const req = (over: Partial<Requisition>): Requisition =>
  ({
    id: 'r',
    requestNumber: 'REQ-2026-0001',
    status: 'pending_supervisor',
    submittedAt: at(0),
    slaDeadline: at(24),
    supervisorDecision: null,
    supervisorDecidedAt: null,
    ...over,
  }) as Requisition;

// The Approving Officer's "Approval History" page showed two made-up 2025
// requests. It is now this officer's real decisions.
describe('decidedRequisitions', () => {
  it('keeps only requisitions the approver has decided, newest decision first', () => {
    const list = [
      req({ id: 'pending' }),
      req({ id: 'old', supervisorDecision: 'approved', supervisorDecidedAt: at(2) }),
      req({ id: 'new', supervisorDecision: 'rejected', supervisorDecidedAt: at(30) }),
    ];
    expect(decidedRequisitions(list).map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('ignores a decision with no timestamp (nothing to show or sort on)', () => {
    expect(decidedRequisitions([req({ supervisorDecision: 'approved', supervisorDecidedAt: null })])).toEqual([]);
  });
});

describe('turnaroundHours', () => {
  it('is submit-to-decision, to one decimal', () => {
    expect(turnaroundHours(req({ supervisorDecidedAt: at(2.26) }))).toBe(2.3);
  });

  it('is null for an undecided requisition', () => {
    expect(turnaroundHours(req({}))).toBeNull();
  });
});

describe('approvalHistorySummary', () => {
  it('counts approvals and rejections, the average turnaround, and decisions inside the SLA', () => {
    const decided = [
      req({ supervisorDecision: 'approved', supervisorDecidedAt: at(2) }), // in time
      req({ supervisorDecision: 'approved', supervisorDecidedAt: at(6) }), // in time
      req({ supervisorDecision: 'rejected', supervisorDecidedAt: at(40) }), // late
    ];
    expect(approvalHistorySummary(decided)).toEqual({
      total: 3,
      approved: 2,
      rejected: 1,
      avgTurnaroundHours: 16,
      withinSla: 2,
    });
  });

  it('has no average for an empty history', () => {
    expect(approvalHistorySummary([])).toEqual({
      total: 0,
      approved: 0,
      rejected: 0,
      avgTurnaroundHours: null,
      withinSla: 0,
    });
  });
});
