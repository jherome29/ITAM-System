import type { Requisition } from '@/lib/api/requisitions';

const HOUR_MS = 3_600_000;

/** Requisitions this approver has decided (approved or rejected), newest decision first. */
export function decidedRequisitions(list: Requisition[]): Requisition[] {
  return list
    .filter((r) => r.supervisorDecision !== null && r.supervisorDecidedAt !== null)
    .sort((a, b) => Date.parse(b.supervisorDecidedAt as string) - Date.parse(a.supervisorDecidedAt as string));
}

/** Hours from submission to the approver's decision, to one decimal; null if undecided. */
export function turnaroundHours(r: Pick<Requisition, 'submittedAt' | 'supervisorDecidedAt'>): number | null {
  if (!r.supervisorDecidedAt) return null;
  return Math.round(((Date.parse(r.supervisorDecidedAt) - Date.parse(r.submittedAt)) / HOUR_MS) * 10) / 10;
}

export interface ApprovalHistorySummary {
  total: number;
  approved: number;
  rejected: number;
  avgTurnaroundHours: number | null;
  /** Decisions made on or before the requisition's SLA deadline. */
  withinSla: number;
}

export function approvalHistorySummary(decided: Requisition[]): ApprovalHistorySummary {
  const hours = decided.map(turnaroundHours).filter((h): h is number => h !== null);
  return {
    total: decided.length,
    approved: decided.filter((r) => r.supervisorDecision === 'approved').length,
    rejected: decided.filter((r) => r.supervisorDecision === 'rejected').length,
    avgTurnaroundHours: hours.length ? Math.round((hours.reduce((sum, h) => sum + h, 0) / hours.length) * 10) / 10 : null,
    withinSla: decided.filter((r) => Date.parse(r.supervisorDecidedAt as string) <= Date.parse(r.slaDeadline)).length,
  };
}
