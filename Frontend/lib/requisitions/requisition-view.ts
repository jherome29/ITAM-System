// Display helpers for requisitions — plain-language status, Philippine-time
// dates, the 24h approval SLA badge, and a timeline built from the stored
// decision timestamps. Pure functions so vitest (node env) can cover them.

const TZ = 'Asia/Manila';
const SLA_WARN_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_supervisor: 'Awaiting approval',
  pending_fulfillment: 'Approved — awaiting fulfillment',
  on_hold: 'On hold',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function requisitionStatusLabel(status: string): string {
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  const words = status.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Newer ICU puts a narrow no-break space before AM/PM; normalise to a space.
const tidy = (s: string) => s.replaceAll(' ', ' ');

/** Date-only values (e.g. requiredDate "2026-10-14") are calendar days — format
 *  them in UTC so the day never shifts with the viewer's timezone. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const day = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0];
  if (!day) return '—';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return tidy(d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ }));
}

export type SlaTone = 'red' | 'amber' | 'slate';

/** Countdown to the approval SLA deadline — only meaningful while a
 *  requisition is still awaiting the approving officer. */
export function slaBadge(
  req: { status: string; slaDeadline?: string | null },
  now: Date = new Date(),
): { label: string; tone: SlaTone } | null {
  if (req.status !== 'pending_supervisor' || !req.slaDeadline) return null;
  const diff = new Date(req.slaDeadline).getTime() - now.getTime();
  const hours = Math.floor(Math.abs(diff) / HOUR_MS);
  const span = hours < 1 ? 'under 1h' : `${hours}h`;
  if (diff < 0) return { label: `Overdue by ${span}`, tone: 'red' };
  return { label: `Due in ${span}`, tone: diff <= SLA_WARN_HOURS * HOUR_MS ? 'amber' : 'slate' };
}

export interface PersonSummary {
  id: string;
  name: string;
  employeeId: string;
  officeOrSection?: string;
}

export function requesterLabel(requester: PersonSummary | null | undefined): string {
  if (!requester) return 'Unknown requester';
  return [requester.name, requester.employeeId, requester.officeOrSection].filter(Boolean).join(' · ');
}

export interface TimelineStep {
  label: string;
  at?: string | null;
  note?: string;
}

interface TimelineInput {
  status: string;
  submittedAt: string;
  alternateRoutedAt?: string | null;
  supervisorDecision: string | null;
  supervisorDecidedAt: string | null;
  supervisorComments: string | null;
  fulfilledAt: string | null;
  fulfillmentNotes: string | null;
  approver?: PersonSummary | null;
}

const withNote = (step: TimelineStep, note: string | null | undefined): TimelineStep =>
  note?.trim() ? { ...step, note: note.trim() } : step;

export function requisitionTimeline(req: TimelineInput): TimelineStep[] {
  const steps: TimelineStep[] = [{ label: 'Submitted for approval', at: req.submittedAt }];
  if (req.alternateRoutedAt) steps.push({ label: 'Routed to alternate approver', at: req.alternateRoutedAt });
  if (req.supervisorDecidedAt) {
    const who = req.approver?.name ?? 'approving officer';
    const verb = req.supervisorDecision === 'rejected' ? 'Rejected' : 'Approved';
    steps.push(withNote({ label: `${verb} by ${who}`, at: req.supervisorDecidedAt }, req.supervisorComments));
  }
  if (req.status === 'on_hold') steps.push(withNote({ label: 'Put on hold by custodian' }, req.fulfillmentNotes));
  if (req.fulfilledAt) steps.push(withNote({ label: 'Fulfilled by custodian', at: req.fulfilledAt }, req.fulfillmentNotes));
  return steps;
}
