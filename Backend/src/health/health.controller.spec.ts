import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

// Pure mock — construct the controller directly with a stubbed DataSource,
// no Nest DI (matches system-config.controller.spec.ts).
describe('HealthController', () => {
  let dataSource: { query: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    controller = new HealthController(dataSource as never);
  });

  it('returns ok + db:true + a numeric uptime when SELECT 1 succeeds', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const res = await controller.check();

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(res.status).toBe('ok');
    expect(res.db).toBe(true);
    expect(typeof res.uptime).toBe('number');
  });

  it('throws ServiceUnavailableException when the DB query fails', async () => {
    dataSource.query.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
