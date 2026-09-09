import { UsersController } from './users.controller';
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
