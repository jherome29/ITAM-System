import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { AssetsService } from '../assets/assets.service';
import { AssetRepairsService } from '../assets/asset-repairs.service';
import { APP_TIME_ZONE } from '../../../packages/shared/src/constants';

/**
 * Aggregated result of one full watcher sweep.
 *
 * Each field is the count of records the corresponding watcher acted on, EXCEPT
 * `-1`, which is a sentinel meaning "that watcher threw and was skipped" — its
 * failure is logged and the other watchers still run. Callers should treat `-1`
 * as "unknown / errored", not as a real count.
 */
export interface CheckSummary {
  slaBreaches: number;
  pendingNudges: number;
  overdueReturns: number;
  lowStock: number;
  overdueRepairs: number;
}

export type WatcherName = keyof CheckSummary;
export type SweepTrigger = 'hourly-cron' | 'daily-cron' | 'manual';

export interface WatcherSweep {
  at: string; // ISO timestamp the sweep finished
  trigger: SweepTrigger;
  summary: Partial<CheckSummary>; // only the watchers that sweep touched
}

/** One watcher's most recent run — survives later sweeps that skip it. */
export interface WatcherRun {
  at: string;
  trigger: SweepTrigger;
  count: number; // -1 = it threw (see CheckSummary)
}

export interface WatcherStatus {
  lastSweep: WatcherSweep | null;
  // Per watcher, so an hourly sweep no longer hides the daily counts.
  watchers: Partial<Record<WatcherName, WatcherRun>>;
}

// SVC: Engage — automated alert scheduling
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  // Last completed sweep — the System Administrator's only window into whether
  // the background watchers are actually firing. In-memory and per-instance;
  // resets on restart (acceptable — it answers "are they running right now?").
  private lastSweep: WatcherSweep | null = null;
  private watchers: Partial<Record<WatcherName, WatcherRun>> = {};

  constructor(
    private readonly requisitions: RequisitionsService,
    private readonly assets: AssetsService,
    private readonly repairs: AssetRepairsService,
  ) {}

  getWatcherStatus(): WatcherStatus {
    return { lastSweep: this.lastSweep, watchers: { ...this.watchers } };
  }

  private record(trigger: SweepTrigger, summary: Partial<CheckSummary>) {
    const at = new Date().toISOString();
    this.lastSweep = { at, trigger, summary };
    for (const [name, count] of Object.entries(summary) as [
      WatcherName,
      number,
    ][]) {
      this.watchers[name] = { at, trigger, count };
    }
  }

  /**
   * Runs a single watcher with its failure isolated: a rejection is logged and
   * swallowed so sibling watchers in the same tick still execute (one failing
   * watcher must not open a 24h gap for the daily job, and an unhandled
   * rejection out of a @Cron callback can crash the process under Node's
   * default handler — @nestjs/schedule v6 does not wrap handler errors).
   * Returns the watcher's count, or `-1` when it threw (see CheckSummary).
   */
  private async runWatcher(
    name: string,
    fn: () => Promise<number>,
  ): Promise<number> {
    try {
      return await fn();
    } catch (e) {
      this.logger.error(
        `${name} failed`,
        e instanceof Error ? e.stack : String(e),
      );
      return -1;
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { timeZone: APP_TIME_ZONE })
  async hourlyChecks(): Promise<void> {
    const slaBreaches = await this.runWatcher('checkSlaBreaches', () =>
      this.requisitions.checkSlaBreaches(),
    );
    const pendingNudges = await this.runWatcher(
      'checkPendingApprovalNudges',
      () => this.requisitions.checkPendingApprovalNudges(),
    );
    this.logger.log(
      `hourly: slaBreaches=${slaBreaches} pendingNudges=${pendingNudges}`,
    );
    this.record('hourly-cron', { slaBreaches, pendingNudges });
  }

  // 7:00 CICC time, whatever the server clock says.
  @Cron(CronExpression.EVERY_DAY_AT_7AM, { timeZone: APP_TIME_ZONE })
  async dailyChecks(): Promise<void> {
    const overdueReturns = await this.runWatcher('checkOverdueReturns', () =>
      this.assets.checkOverdueReturns(),
    );
    const lowStock = await this.runWatcher('checkLowStock', () =>
      this.assets.checkLowStock(),
    );
    const overdueRepairs = await this.runWatcher('checkOverdueRepairs', () =>
      this.repairs.checkOverdue(),
    );
    this.logger.log(
      `daily: overdueReturns=${overdueReturns} lowStock=${lowStock} overdueRepairs=${overdueRepairs}`,
    );
    this.record('daily-cron', { overdueReturns, lowStock, overdueRepairs });
  }

  async runAllChecks(): Promise<CheckSummary> {
    const summary: CheckSummary = {
      slaBreaches: await this.runWatcher('checkSlaBreaches', () =>
        this.requisitions.checkSlaBreaches(),
      ),
      pendingNudges: await this.runWatcher('checkPendingApprovalNudges', () =>
        this.requisitions.checkPendingApprovalNudges(),
      ),
      overdueReturns: await this.runWatcher('checkOverdueReturns', () =>
        this.assets.checkOverdueReturns(),
      ),
      lowStock: await this.runWatcher('checkLowStock', () =>
        this.assets.checkLowStock(),
      ),
      overdueRepairs: await this.runWatcher('checkOverdueRepairs', () =>
        this.repairs.checkOverdue(),
      ),
    };
    this.record('manual', summary);
    return summary;
  }
}
