import { SchedulerController } from './scheduler.controller';
import type { SchedulerService } from './scheduler.service';

describe('SchedulerController', () => {
  it('run-checks delegates to runAllChecks and wraps the summary', async () => {
    const summary = {
      slaBreaches: 1,
      pendingNudges: 0,
      overdueReturns: 2,
      lowStock: 0,
    };
    const scheduler = {
      runAllChecks: jest.fn().mockResolvedValue(summary),
    } as unknown as SchedulerService;

    const res = await new SchedulerController(scheduler).runChecks();

    expect(res).toEqual({
      data: summary,
      message: 'Notification checks executed',
    });
  });

  it('watcher-status returns the last sweep in the standard envelope', () => {
    const status = {
      lastSweep: {
        at: '2026-09-09T10:00:00.000Z',
        trigger: 'manual' as const,
        summary: { slaBreaches: 0, pendingNudges: 0 },
      },
    };
    const scheduler = {
      getWatcherStatus: jest.fn().mockReturnValue(status),
    } as unknown as SchedulerService;

    const res = new SchedulerController(scheduler).watcherStatus();

    expect(res).toEqual({
      data: status,
      message: 'Watcher status retrieved',
    });
  });
});
