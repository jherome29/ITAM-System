import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignRoleDto, CreateUserDto } from './user.dto';
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
