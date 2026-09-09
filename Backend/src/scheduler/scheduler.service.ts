import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { AssetsService } from '../assets/assets.service';

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
}

export interface WatcherSweep {
  at: string; // ISO timestamp the sweep finished
  trigger: 'hourly-cron' | 'daily-cron' | 'manual';
  summary: Partial<CheckSummary>; // only the watchers that sweep touched
}

// SVC: Engage — automated alert scheduling
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  // Last completed sweep — the System Administrator's only window into whether
  // the background watchers are actually firing. In-memory and per-instance;
  // resets on restart (acceptable — it answers "are they running right now?").
  private lastSweep: WatcherSweep | null = null;

  constructor(
    private readonly requisitions: RequisitionsService,
    private readonly assets: AssetsService,
  ) {}

  getWatcherStatus(): { lastSweep: WatcherSweep | null } {
    return { lastSweep: this.lastSweep };
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

  @Cron(CronExpression.EVERY_HOUR)
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
    this.lastSweep = {
      at: new Date().toISOString(),
      trigger: 'hourly-cron',
      summary: { slaBreaches, pendingNudges },
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async dailyChecks(): Promise<void> {
    const overdueReturns = await this.runWatcher('checkOverdueReturns', () =>
      this.assets.checkOverdueReturns(),
    );
    const lowStock = await this.runWatcher('checkLowStock', () =>
      this.assets.checkLowStock(),
    );
    this.logger.log(
      `daily: overdueReturns=${overdueReturns} lowStock=${lowStock}`,
    );
    this.lastSweep = {
      at: new Date().toISOString(),
      trigger: 'daily-cron',
      summary: { overdueReturns, lowStock },
    };
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
    };
    this.lastSweep = {
      at: new Date().toISOString(),
      trigger: 'manual',
      summary,
    };
    return summary;
  }
}
