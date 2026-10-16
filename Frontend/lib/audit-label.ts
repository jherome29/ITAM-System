import type { AuditLog } from '@/lib/api/audit';

/**
 * Text for an audit entry's action. Normally the action in words; a rejected
 * refresh-token reuse is logged under `user_login_failed` (the action column is
 * a native enum with no value for it), so it is named for what happened — a
 * session ended — instead of looking like a wrong password.
 */
export function auditEventLabel(log: Pick<AuditLog, 'action' | 'metadata'>): string {
  if (log.action === 'user_login_failed' && log.metadata?.reason === 'refresh_token_reuse_detected') {
    return 'session invalidated';
  }
  return log.action.replace(/_/g, ' ');
}

const shortId = (id: string) => `${id.slice(0, 8)}…`;

/** Who did it: their name, or a short id when the account no longer resolves. */
export function auditUserText(log: Pick<AuditLog, 'userId'> & { userName?: string | null }): string {
  return log.userName || shortId(log.userId);
}

/** What it was done to: the record's own label ("AR-2026-0014"), or its type and a short id. */
export function auditRecordText(
  log: Pick<AuditLog, 'affectedRecordType' | 'affectedRecordId'> & { recordLabel?: string | null },
): string {
  if (log.recordLabel) return log.recordLabel;
  if (!log.affectedRecordId) return log.affectedRecordType ?? '—';
  return `${log.affectedRecordType ?? 'record'} ${shortId(log.affectedRecordId)}`;
}

