import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UsersController } from './users.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';

describe('UsersController — revokeSessions', () => {
  it('delegates to the service with the target id and the acting admin id/role/ip', async () => {
    const svc = {
      revokeSessions: jest
        .fn()
        .mockResolvedValue({ message: 'All sessions revoked for EMP-001' }),
    };
    const controller = new UsersController(svc as never);
    const req = {
      user: { id: 'admin-1', role: UserRole.SYSTEM_ADMIN },
      ip: '10.0.0.9',
    };

    const res = await controller.revokeSessions('user-2', req as never);

    expect(svc.revokeSessions).toHaveBeenCalledWith(
      'user-2',
      'admin-1',
      UserRole.SYSTEM_ADMIN,
      '10.0.0.9',
    );
    expect(res).toEqual({
      message: 'All sessions revoked for EMP-001',
      data: null,
    });
  });
});

describe('UsersController — self-service availability', () => {
  const svc = {
    setOwnAvailability: jest
      .fn()
      .mockResolvedValue({ id: 'sup-1', unavailable: true }),
  };
  const controller = new UsersController(svc as never);

  it('delegates to setOwnAvailability with the caller id, dto, role and ip', async () => {
    const req = {
      user: { id: 'sup-1', role: UserRole.SUPERVISOR },
      ip: '10.0.0.9',
    };
    const dto = { unavailable: true, unavailableUntil: null };

    const res = await controller.updateOwnAvailability(req as never, dto);

    expect(svc.setOwnAvailability).toHaveBeenCalledWith(
      'sup-1',
      dto,
      UserRole.SUPERVISOR,
      '10.0.0.9',
    );
    expect(res).toEqual({
      message: expect.any(String),
      data: { id: 'sup-1', unavailable: true },
    });
  });
});

// Account management is the System Administrator's alone (CLAUDE.md 4, ROLES.md:
// "User account management ... Management: —"). GET /users and GET /users/:id
// were also open to Management, which no screen uses and no document grants:
// the directory lists every employee's name, email, employee ID, division and
// lock state. Pinning the whole matrix (route -> allowed roles) means a role
// cannot be added to a user route without editing this test.
describe('UsersController — who may call which route', () => {
  const prototype = UsersController.prototype as unknown as Record<
    string,
    () => unknown
  >;

  const matrix = Object.fromEntries(
    Object.getOwnPropertyNames(UsersController.prototype)
      .filter((name) => name !== 'constructor')
      .flatMap((name) => {
        const handler = prototype[name];
        const path = Reflect.getMetadata(PATH_METADATA, handler) as
          | string
          | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined;
        const roles = Reflect.getMetadata(ROLES_KEY, handler) as
          | UserRole[]
          | undefined;
        return path === undefined || method === undefined
          ? []
          : [[`${RequestMethod[method]} ${path}`, [...(roles ?? [])].sort()]];
      }),
  ) as Record<string, UserRole[]>;

  const ADMIN = [UserRole.SYSTEM_ADMIN];

  it('lists and reads accounts for the System Administrator only', () => {
    expect(matrix['GET /']).toEqual(ADMIN);
    expect(matrix['GET :id']).toEqual(ADMIN);
  });

  it('keeps every other route admin-only, except a supervisor setting their own availability', () => {
    const others = Object.entries(matrix).filter(
      ([route]) =>
        route !== 'GET /' &&
        route !== 'GET :id' &&
        route !== 'PATCH me/availability',
    );
    expect(others.length).toBeGreaterThanOrEqual(8); // create, edit, role, reset, unlock, revoke, activate, deactivate
    for (const [route, roles] of others) {
      expect({ route, roles }).toEqual({ route, roles: ADMIN });
    }
    expect(matrix['PATCH me/availability']).toEqual(
      [UserRole.SUPERVISOR, UserRole.SYSTEM_ADMIN].sort(),
    );
  });
});
