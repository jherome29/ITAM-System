import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { AssetsService } from '../assets/assets.service';
import { AssetRepairsService } from '../assets/asset-repairs.service';
import { APP_TIME_ZONE } from '../../../packages/shared/src/constants';

describe('SchedulerService', () => {
  let service: SchedulerService;
  const requisitions = {
    checkSlaBreaches: jest.fn(),
    checkPendingApprovalNudges: jest.fn(),
  };
  const assets = { checkOverdueReturns: jest.fn(), checkLowStock: jest.fn() };
  const repairs = { checkOverdue: jest.fn() };
  // Silence (and observe) the isolation-path error logging.
  let errorLog: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const mod = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: RequisitionsService, useValue: requisitions },
        { provide: AssetsService, useValue: assets },
        { provide: AssetRepairsService, useValue: repairs },
      ],
    }).compile();
    service = mod.get(SchedulerService);
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  it('runAllChecks aggregates the five watcher counts, each called exactly once', async () => {
    requisitions.checkSlaBreaches.mockResolvedValue(2);
    requisitions.checkPendingApprovalNudges.mockResolvedValue(1);
    assets.checkOverdueReturns.mockResolvedValue(3);
    assets.checkLowStock.mockResolvedValue(4);
    repairs.checkOverdue.mockResolvedValue(5);

    await expect(service.runAllChecks()).resolves.toEqual({
      slaBreaches: 2,
      pendingNudges: 1,
      overdueReturns: 3,
      lowStock: 4,
      overdueRepairs: 5,
    });

    expect(requisitions.checkSlaBreaches).toHaveBeenCalledTimes(1);
    expect(requisitions.checkPendingApprovalNudges).toHaveBeenCalledTimes(1);
    expect(assets.checkOverdueReturns).toHaveBeenCalledTimes(1);
    expect(assets.checkLowStock).toHaveBeenCalledTimes(1);
    expect(repairs.checkOverdue).toHaveBeenCalledTimes(1);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('runAllChecks isolates a failing watcher: -1 for that key, real counts + calls for the rest', async () => {
    requisitions.checkSlaBreaches.mockResolvedValue(2);
    requisitions.checkPendingApprovalNudges.mockRejectedValue(
      new Error('db exploded'),
    );
    assets.checkOverdueReturns.mockResolvedValue(3);
    assets.checkLowStock.mockResolvedValue(4);
    repairs.checkOverdue.mockResolvedValue(0);

    await expect(service.runAllChecks()).resolves.toEqual({
      slaBreaches: 2,
      pendingNudges: -1,
      overdueReturns: 3,
      lowStock: 4,
      overdueRepairs: 0,
    });

    // The rejection of one watcher must not skip the others.
    expect(requisitions.checkSlaBreaches).toHaveBeenCalledTimes(1);
    expect(requisitions.checkPendingApprovalNudges).toHaveBeenCalledTimes(1);
    expect(assets.checkOverdueReturns).toHaveBeenCalledTimes(1);
    expect(assets.checkLowStock).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('hourlyChecks calls only the hourly watchers', async () => {
    requisitions.checkSlaBreaches.mockResolvedValue(0);
    requisitions.checkPendingApprovalNudges.mockResolvedValue(0);
    await service.hourlyChecks();
    expect(requisitions.checkSlaBreaches).toHaveBeenCalledTimes(1);
    expect(requisitions.checkPendingApprovalNudges).toHaveBeenCalledTimes(1);
    expect(assets.checkOverdueReturns).not.toHaveBeenCalled();
    expect(assets.checkLowStock).not.toHaveBeenCalled();
    expect(repairs.checkOverdue).not.toHaveBeenCalled();
  });

  it('dailyChecks calls only the daily watchers', async () => {
    assets.checkOverdueReturns.mockResolvedValue(0);
    assets.checkLowStock.mockResolvedValue(0);
    repairs.checkOverdue.mockResolvedValue(0);
    await service.dailyChecks();
    expect(assets.checkOverdueReturns).toHaveBeenCalledTimes(1);
    expect(assets.checkLowStock).toHaveBeenCalledTimes(1);
    expect(repairs.checkOverdue).toHaveBeenCalledTimes(1);
    expect(requisitions.checkSlaBreaches).not.toHaveBeenCalled();
    expect(requisitions.checkPendingApprovalNudges).not.toHaveBeenCalled();
  });

  it('hourlyChecks swallows a watcher rejection and still runs the sibling', async () => {
    requisitions.checkSlaBreaches.mockRejectedValue(new Error('boom'));
    requisitions.checkPendingApprovalNudges.mockResolvedValue(0);
    await expect(service.hourlyChecks()).resolves.toBeUndefined();
    expect(requisitions.checkPendingApprovalNudges).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  describe('getWatcherStatus()', () => {
    it('reports no sweep before any watcher has run', () => {
      expect(service.getWatcherStatus()).toEqual({
        lastSweep: null,
        watchers: {},
      });
    });

    it('records a manual sweep after runAllChecks with the full summary', async () => {
      requisitions.checkSlaBreaches.mockResolvedValue(2);
      requisitions.checkPendingApprovalNudges.mockResolvedValue(1);
      assets.checkOverdueReturns.mockResolvedValue(0);
      assets.checkLowStock.mockResolvedValue(3);
      repairs.checkOverdue.mockResolvedValue(1);

      await service.runAllChecks();
      const { lastSweep } = service.getWatcherStatus();

      expect(lastSweep?.trigger).toBe('manual');
      expect(lastSweep?.summary).toEqual({
        slaBreaches: 2,
        pendingNudges: 1,
        overdueReturns: 0,
        lowStock: 3,
        overdueRepairs: 1,
      });
      expect(Number.isNaN(Date.parse(lastSweep?.at ?? ''))).toBe(false);
    });

    it('records an hourly-cron sweep with just the hourly counts', async () => {
      requisitions.checkSlaBreaches.mockResolvedValue(1);
      requisitions.checkPendingApprovalNudges.mockResolvedValue(0);

      await service.hourlyChecks();
      const { lastSweep } = service.getWatcherStatus();

      expect(lastSweep?.trigger).toBe('hourly-cron');
      expect(lastSweep?.summary).toEqual({ slaBreaches: 1, pendingNudges: 0 });
    });

    it('keeps each watcher on its own last run, so an hourly sweep does not hide the daily counts', async () => {
      assets.checkOverdueReturns.mockResolvedValue(2);
      assets.checkLowStock.mockResolvedValue(0);
      repairs.checkOverdue.mockResolvedValue(4);
      await service.dailyChecks();

      requisitions.checkSlaBreaches.mockRejectedValue(new Error('boom'));
      requisitions.checkPendingApprovalNudges.mockResolvedValue(1);
      await service.hourlyChecks();

      const { watchers, lastSweep } = service.getWatcherStatus();
      expect(lastSweep?.trigger).toBe('hourly-cron');
      expect(watchers.overdueRepairs).toMatchObject({
        trigger: 'daily-cron',
        count: 4,
      });
      expect(watchers.overdueReturns?.count).toBe(2);
      expect(watchers.slaBreaches).toMatchObject({
        trigger: 'hourly-cron',
        count: -1,
      });
      expect(watchers.pendingNudges?.count).toBe(1);
    });
  });

  // @nestjs/schedule keeps each @Cron's options under this metadata key. The
  // daily 7:00 jobs (overdue returns, low stock, overdue repairs) read "7:00" in
  // the server's clock, which in a default UTC container is 15:00 in Manila.
  describe('cron schedule time zone', () => {
    const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

    it.each(['hourlyChecks', 'dailyChecks'] as const)(
      '%s runs on the CICC clock, not the server clock',
      (method) => {
        const options = Reflect.getMetadata(
          SCHEDULE_CRON_OPTIONS,
          SchedulerService.prototype[method],
        ) as { timeZone?: string } | undefined;

        expect(options?.timeZone).toBe(APP_TIME_ZONE);
      },
    );
  });
});
