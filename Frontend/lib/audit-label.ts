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
