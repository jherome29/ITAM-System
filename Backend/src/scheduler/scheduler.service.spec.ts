import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { AssetsService } from '../assets/assets.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  const requisitions = {
    checkSlaBreaches: jest.fn(),
    checkPendingApprovalNudges: jest.fn(),
  };
  const assets = { checkOverdueReturns: jest.fn(), checkLowStock: jest.fn() };
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
      ],
    }).compile();
    service = mod.get(SchedulerService);
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  it('runAllChecks aggregates the four watcher counts, each called exactly once', async () => {
    requisitions.checkSlaBreaches.mockResolvedValue(2);
    requisitions.checkPendingApprovalNudges.mockResolvedValue(1);
    assets.checkOverdueReturns.mockResolvedValue(3);
    assets.checkLowStock.mockResolvedValue(4);

    await expect(service.runAllChecks()).resolves.toEqual({
      slaBreaches: 2,
      pendingNudges: 1,
      overdueReturns: 3,
      lowStock: 4,
    });

    expect(requisitions.checkSlaBreaches).toHaveBeenCalledTimes(1);
    expect(requisitions.checkPendingApprovalNudges).toHaveBeenCalledTimes(1);
    expect(assets.checkOverdueReturns).toHaveBeenCalledTimes(1);
    expect(assets.checkLowStock).toHaveBeenCalledTimes(1);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('runAllChecks isolates a failing watcher: -1 for that key, real counts + calls for the rest', async () => {
    requisitions.checkSlaBreaches.mockResolvedValue(2);
    requisitions.checkPendingApprovalNudges.mockRejectedValue(
      new Error('db exploded'),
    );
    assets.checkOverdueReturns.mockResolvedValue(3);
    assets.checkLowStock.mockResolvedValue(4);

    await expect(service.runAllChecks()).resolves.toEqual({
      slaBreaches: 2,
      pendingNudges: -1,
      overdueReturns: 3,
      lowStock: 4,
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
  });

  it('dailyChecks calls only the daily watchers', async () => {
    assets.checkOverdueReturns.mockResolvedValue(0);
    assets.checkLowStock.mockResolvedValue(0);
    await service.dailyChecks();
    expect(assets.checkOverdueReturns).toHaveBeenCalledTimes(1);
    expect(assets.checkLowStock).toHaveBeenCalledTimes(1);
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
});
