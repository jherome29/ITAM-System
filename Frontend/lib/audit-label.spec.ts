import { describe, expect, it } from 'vitest';
import { auditEventLabel, auditRecordText, auditUserText } from './audit-label';

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

// The audit screens printed "User ID 54a576d7-1e24-..." and "asset_request
// 017fa908…" - accurate, and useless to the person reading them. The API now
// sends the person's name and a label for the record; these fall back to the ids
// only when it has none.
describe('auditUserText', () => {
  it('shows the name when there is one', () => {
    expect(auditUserText({ userId: 'u-1', userName: 'Jose Reyes' })).toBe('Jose Reyes');
  });

  it('falls back to a short id for an account that no longer resolves', () => {
    expect(auditUserText({ userId: '54a576d7-1e24-43e4-8759-e0af897cb016', userName: null })).toBe('54a576d7…');
    expect(auditUserText({ userId: '54a576d7-1e24-43e4-8759-e0af897cb016' })).toBe('54a576d7…');
  });
});

describe('auditRecordText', () => {
  it('shows the label when there is one', () => {
    expect(
      auditRecordText({ affectedRecordType: 'asset_request', affectedRecordId: '017fa908-607c', recordLabel: 'AR-2026-0016' }),
    ).toBe('AR-2026-0016');
  });

  it('falls back to the type and a short id', () => {
    expect(
      auditRecordText({ affectedRecordType: 'form', affectedRecordId: '017fa908-607c-4218', recordLabel: null }),
    ).toBe('form 017fa908…');
  });

  it('copes with an entry about no particular record', () => {
    expect(auditRecordText({ affectedRecordType: null, affectedRecordId: null })).toBe('—');
  });
});
