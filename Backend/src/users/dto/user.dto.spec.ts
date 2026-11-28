import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignRoleDto, CreateUserDto, UpdateUserDto } from './user.dto';
import { FIELD_MAX } from '../../common/field-limits';
import {
  ASSIGNABLE_USER_ROLES,
  UserRole,
} from '../../../../packages/shared/src/enums';

// The Property Officer role was merged into the Property Custodian: the value
// stays in the database enum for old audit rows, but no account may be given it.

const newUser = (role: string) => ({
  employeeId: 'CICC-0001',
  firstName: 'Ana',
  lastName: 'Reyes',
  email: 'ana.reyes@cicc.gov.ph',
  password: 'Str0ng!Passphrase#1',
  role,
  division: 'Property and Supply Management',
  officeOrSection: 'Property Custody Unit',
});

const problems = async (dto: object) =>
  (await validate(dto)).flatMap((e) => Object.values(e.constraints ?? {}));

describe('assigning a role', () => {
  it.each(ASSIGNABLE_USER_ROLES)(
    'accepts %s when creating an account',
    async (role) => {
      const dto = plainToInstance(CreateUserDto, newUser(role));

      expect(await problems(dto)).toEqual([]);
    },
  );

  it('refuses the retired Property Officer role when creating an account', async () => {
    const dto = plainToInstance(
      CreateUserDto,
      newUser(UserRole.PROPERTY_OFFICER),
    );

    expect(await problems(dto)).not.toEqual([]);
  });

  it.each(ASSIGNABLE_USER_ROLES)(
    'accepts %s on a role change',
    async (role) => {
      const dto = plainToInstance(AssignRoleDto, { role });

      expect(await problems(dto)).toEqual([]);
    },
  );

  it('refuses the retired role on a role change, and the message does not offer it', async () => {
    const dto = plainToInstance(AssignRoleDto, {
      role: UserRole.PROPERTY_OFFICER,
    });
    const messages = await problems(dto);

    expect(messages).not.toEqual([]);
    expect(messages.join(' ')).not.toContain('property_officer');
    expect(messages.join(' ')).toContain('property_custodian');
  });
});

// first_name, last_name, division and office_or_section are VARCHAR(100), employee_id (50) and
// email (255) in Database/schemas/001_initial_schema.sql. A longer name went to Postgres and came
// back as a bare 500; the field is now named in a 400.
describe('account text limits', () => {
  const LIMITED = [
    ['employeeId', FIELD_MAX.employeeId],
    ['firstName', FIELD_MAX.code],
    ['lastName', FIELD_MAX.code],
    ['division', FIELD_MAX.code],
    ['officeOrSection', FIELD_MAX.code],
  ] as const;

  describe.each([
    ['CreateUserDto', CreateUserDto],
    ['UpdateUserDto', UpdateUserDto],
  ])('%s', (name, cls) => {
    it.each(LIMITED)(
      'refuses a %s longer than %i characters, by name',
      async (field, max) => {
        if (name === 'UpdateUserDto' && field === 'employeeId') return; // an account's ID is never edited
        const dto = plainToInstance(cls as new () => object, {
          ...newUser('employee'),
          [field]: 'N'.repeat(max + 1),
        });

        const found = await problems(dto);

        expect(found).toEqual([expect.stringContaining(field)]);
        expect(found[0]).toContain(String(max));
      },
    );

    it.each(LIMITED)(
      'accepts a %s of exactly %i characters',
      async (field, max) => {
        if (name === 'UpdateUserDto' && field === 'employeeId') return;
        const dto = plainToInstance(cls as new () => object, {
          ...newUser('employee'),
          [field]: 'N'.repeat(max),
        });

        expect(await problems(dto)).toEqual([]);
      },
    );
  });
});
