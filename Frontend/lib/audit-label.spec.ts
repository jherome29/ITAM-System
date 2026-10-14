import { describe, expect, it } from 'vitest';
import { auditEventLabel } from './audit-label';

// A superseded session's rejected refresh is logged as `user_login_failed`
// (the action column is a native enum with no value for it), so every audit
// screen that printed the raw action showed it as a failed login.
describe('auditEventLabel', () => {
  it('prints an ordinary action in words', () => {
    expect(auditEventLabel({ action: 'asset_issued', metadata: null })).toBe('asset issued');
    expect(auditEventLabel({ action: 'user_login', metadata: {} })).toBe('user login');
  });

  it('keeps a genuine failed sign-in as a failed login', () => {
    expect(auditEventLabel({ action: 'user_login_failed', metadata: null })).toBe('user login failed');
    expect(auditEventLabel({ action: 'user_login_failed', metadata: { reason: 'bad_password' } })).toBe(
      'user login failed',
    );
  });

  it('names a refresh-token reuse rejection for what it is — a session ended, not a wrong password', () => {
    expect(
      auditEventLabel({ action: 'user_login_failed', metadata: { reason: 'refresh_token_reuse_detected' } }),
    ).toBe('session invalidated');
  });

  it('only reinterprets that reason on user_login_failed', () => {
    expect(
      auditEventLabel({ action: 'user_updated', metadata: { reason: 'refresh_token_reuse_detected' } }),
    ).toBe('user updated');
  });
});
