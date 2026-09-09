import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

describe('AdminController', () => {
  it('wraps the service stats in the standard response envelope', async () => {
    const stats = { users: { total: 3 } };
    const service = {
      getDashboardStats: jest.fn().mockResolvedValue(stats),
    } as unknown as AdminService;

    const controller = new AdminController(service);
    const res = await controller.dashboardStats();

    expect(res).toEqual({
      data: stats,
      message: 'Admin dashboard statistics retrieved',
    });
    expect(service.getDashboardStats).toHaveBeenCalledTimes(1);
  });
});
