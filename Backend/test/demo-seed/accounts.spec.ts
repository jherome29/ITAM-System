import { parseAccounts, REQUIRED_ROLES } from './accounts';

// The seed logs in as real accounts, so the credentials file is the one
// secret-bearing input. These tests pin the failure modes that would otherwise
// surface as a confusing 401 halfway through a run — and make sure no error
// message ever echoes a password back.

const valid = () =>
  Object.fromEntries(
    REQUIRED_ROLES.map((role) => [
      role,
      { login: `${role}@example.test`, password: `pw-for-${role}-1` },
    ]),
  );

describe('parseAccounts', () => {
  it('returns one login/password pair per required role', () => {
    const accounts = parseAccounts(valid());
    for (const role of REQUIRED_ROLES) {
      expect(accounts[role].login).toBe(`${role}@example.test`);
      expect(accounts[role].password).toBe(`pw-for-${role}-1`);
    }
  });

  it('names the role that is missing', () => {
    const raw = valid() as Record<string, unknown>;
    delete raw['property_custodian'];
    expect(() => parseAccounts(raw)).toThrow(/property_custodian/);
  });

  it('rejects an empty password without echoing any password', () => {
    const raw = valid() as Record<string, { login: string; password: string }>;
    raw['employee'].password = '';
    let message = '';
    try {
      parseAccounts(raw);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/employee/);
    expect(message).not.toContain('pw-for-');
  });

  it('rejects the untouched example file', () => {
    const raw = valid() as Record<string, { login: string; password: string }>;
    raw['supervisor'].password = 'CHANGE-ME';
    expect(() => parseAccounts(raw)).toThrow(/supervisor/);
  });

  it('rejects anything that is not an object', () => {
    expect(() => parseAccounts(null)).toThrow();
    expect(() => parseAccounts('nope')).toThrow();
  });
});
