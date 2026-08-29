import { UsersController } from './users.controller';
import { UserRole } from '../../../packages/shared/src/enums';

describe('UsersController — self-service availability', () => {
  const svc = { setOwnAvailability: jest.fn().mockResolvedValue({ id: 'sup-1', unavailable: true }) };
  const controller = new UsersController(svc as never);

  it('delegates to setOwnAvailability with the caller id, dto, role and ip', async () => {
    const req = { user: { id: 'sup-1', role: UserRole.SUPERVISOR }, ip: '10.0.0.9' };
    const dto = { unavailable: true, unavailableUntil: null };

    const res = await controller.updateOwnAvailability(req as never, dto as never);

    expect(svc.setOwnAvailability).toHaveBeenCalledWith('sup-1', dto, UserRole.SUPERVISOR, '10.0.0.9');
    expect(res).toEqual({ message: expect.any(String), data: { id: 'sup-1', unavailable: true } });
  });
});
