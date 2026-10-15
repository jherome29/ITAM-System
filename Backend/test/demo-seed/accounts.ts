import { UserRole } from '../../../packages/shared/src/enums';

// The seed acts as real users, so it needs real logins — but credentials must
// never live in the repo (CLAUDE.md §8.5). They come from an untracked JSON file
// whose path is passed in; this module only validates its shape.

/** Roles the seed actually logs in as. Management and the Property Officer only
 *  read, so they are not needed. */
export const REQUIRED_ROLES = [
  UserRole.EMPLOYEE,
  UserRole.SUPERVISOR,
  UserRole.IT_PERSONNEL,
  UserRole.PROPERTY_CUSTODIAN,
  UserRole.SYSTEM_ADMIN,
] as const;

export type SeedRole = (typeof REQUIRED_ROLES)[number];

export interface Credentials {
  login: string;
  password: string;
}

export type Accounts = Record<SeedRole, Credentials>;

/** Value shipped in accounts.example.json — present means "not filled in". */
const PLACEHOLDER = 'CHANGE-ME';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates the parsed accounts file. Errors name the role and the problem but
 * never the offending value, so a bad password can't end up in a terminal log.
 */
export function parseAccounts(raw: unknown): Accounts {
  if (!isRecord(raw)) {
    throw new Error('Accounts file must be a JSON object keyed by role.');
  }
  const accounts = {} as Accounts;
  for (const role of REQUIRED_ROLES) {
    const entry = raw[role];
    if (!isRecord(entry)) {
      throw new Error(`Accounts file has no entry for role "${role}".`);
    }
    const { login, password } = entry;
    if (typeof login !== 'string' || login.trim() === '') {
      throw new Error(`Accounts file: "${role}" needs a non-empty login.`);
    }
    if (
      typeof password !== 'string' ||
      password === '' ||
      password === PLACEHOLDER
    ) {
      throw new Error(
        `Accounts file: "${role}" needs a real password (empty or still the example placeholder).`,
      );
    }
    accounts[role] = { login: login.trim(), password };
  }
  return accounts;
}
