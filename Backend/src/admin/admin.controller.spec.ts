import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';
import type { UserEntity } from '../users/entities/user.entity';

describe('AdminController', () => {
  it('wraps the service stats in the standard response envelope', async () => {
    const stats = { users: { total: 3 } };
    const service = {
      getDashboardStats: jest.fn().mockResolvedValue(stats),
    } as unknown as AdminService;
    const admin = { id: 'admin-1' } as UserEntity;

    const controller = new AdminController(service);
    const res = await controller.dashboardStats({ user: admin });

    expect(res).toEqual({
      data: stats,
      message: 'Admin dashboard statistics retrieved',
    });
    expect(service.getDashboardStats).toHaveBeenCalledTimes(1);
  });

  // "What waits for you" is per administrator: the service decides what this caller may act on.
  it('asks for the stats as the signed-in administrator', async () => {
    const service = {
      getDashboardStats: jest.fn().mockResolvedValue({}),
    } as unknown as AdminService;
    const admin = { id: 'admin-1' } as UserEntity;

    await new AdminController(service).dashboardStats({ user: admin });

    expect(service.getDashboardStats).toHaveBeenCalledWith(admin);
  });
});
