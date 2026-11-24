import type { AuditLog } from '@/lib/api/audit';
import { auditEventLabel } from '@/lib/audit-label';

// What the asset page's "Transaction History" shows for one audit entry: the
// event in plain words, who did it (by role - the audit trail keeps the user id,
// not a name), and the details worth reading (status change, destination, notes).

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  supervisor: 'Approving Officer',
  it_personnel: 'IT Asset Custodian',
  property_custodian: 'Property Custodian',
  property_officer: 'Property Officer',
  system_admin: 'Master Administrator',
  management: 'Management & Audit Viewer',
};

const sentence = (value: string) => {
  const text = value.replaceAll('_', ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'System';
  return ROLE_LABELS[role] ?? sentence(role);
}

const EVENT_LABELS: Record<string, string> = {
  asset_created: 'Registered',
  asset_issued: 'Issued',
  asset_returned: 'Returned',
  asset_transferred: 'Transferred',
  asset_flagged_repair: 'Sent to repair',
  asset_flagged_disposal: 'Flagged for disposal',
  asset_disposed: 'Disposed',
  qr_generated: 'QR code generated',
  repair_updated: 'Repair progress logged',
  repair_completed: 'Repair completed',
  form_generated: 'Form generated',
};

/** `asset_updated` is both a field edit and the move to "available" (the status map has no action of its own for it). */
const STATUS_EVENT: Record<string, string> = { available: 'Made available' };

/** "officeOrSection" → "office or section". */
const fieldName = (field: string) => field.replaceAll(/([A-Z])/g, ' $1').toLowerCase().trim();

type Meta = Record<string, unknown>;
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

export interface HistoryEntry {
  id: string;
  when: string;
  event: string;
  by: string;
  details: string[];
}

export function describeHistory(entry: AuditLog): HistoryEntry {
  const meta: Meta = entry.metadata ?? {};
  const from = text(meta.fromStatus);
  const to = text(meta.toStatus);

  let event = EVENT_LABELS[entry.action];
  if (!event && entry.action === 'asset_updated') {
    if (to) event = STATUS_EVENT[to] ?? `Moved to ${sentence(to).toLowerCase()}`;
    else event = 'Details edited';
  }
  event ??= sentence(auditEventLabel(entry));

  const details: string[] = [];
  if (from && to) details.push(`${sentence(from)} → ${sentence(to)}`);
  const fromLocation = text(meta.fromLocation);
  const toLocation = text(meta.toLocation);
  if (fromLocation) details.push(`From: ${fromLocation}`);
  if (toLocation) details.push(`To: ${toLocation}`);
  const office = text(meta.officeOrSection);
  const room = text(meta.officeLocation);
  if (office || room) details.push(`Now at: ${[office, room].filter(Boolean).join(' · ')}`);
  if (Array.isArray(meta.updatedFields) && meta.updatedFields.length > 0) {
    details.push(`Changed: ${meta.updatedFields.map((f) => fieldName(String(f))).join(', ')}`);
  }
  const outcome = text(meta.outcome);
  if (outcome) details.push(`Outcome: ${sentence(outcome)}`);
  const notes = text(meta.notes);
  if (notes) details.push(notes);

  return { id: entry.id, when: entry.timestamp, event, by: roleLabel(entry.userRole), details };
}

/** The asset's history, newest first. Anything that is not a list is no history. */
export function historyEntries(logs: readonly AuditLog[] | null | undefined): HistoryEntry[] {
  if (!Array.isArray(logs)) return [];
  return [...logs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map(describeHistory);
}

interface Move {
  action: string;
  toLocation?: string | null;
  timestamp: string;
}

/** Where the asset's latest transfer sent it, from its location history; null if it was never transferred. */
export function lastTransfer(moves: readonly Move[] | null | undefined): { to: string; at: string } | null {
  const latest = [...(moves ?? [])]
    .filter((m) => m.action === 'asset_transferred' && m.toLocation)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  return latest ? { to: latest.toLocation as string, at: latest.timestamp } : null;
}
