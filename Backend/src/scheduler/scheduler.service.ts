import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { AssetsService } from '../assets/assets.service';

export interface CheckSummary {
  slaBreaches: number;
  pendingNudges: number;
  overdueReturns: number;
  lowStock: number;
}

// SVC: Engage — automated alert scheduling
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly requisitions: RequisitionsService,
    private readonly assets: AssetsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async hourlyChecks(): Promise<void> {
    const slaBreaches = await this.requisitions.checkSlaBreaches();
    const pendingNudges = await this.requisitions.checkPendingApprovalNudges();
    this.logger.log(
      `hourly: slaBreaches=${slaBreaches} pendingNudges=${pendingNudges}`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async dailyChecks(): Promise<void> {
    const overdueReturns = await this.assets.checkOverdueReturns();
    const lowStock = await this.assets.checkLowStock();
    this.logger.log(
      `daily: overdueReturns=${overdueReturns} lowStock=${lowStock}`,
    );
  }

  async runAllChecks(): Promise<CheckSummary> {
    return {
      slaBreaches: await this.requisitions.checkSlaBreaches(),
      pendingNudges: await this.requisitions.checkPendingApprovalNudges(),
      overdueReturns: await this.assets.checkOverdueReturns(),
      lowStock: await this.assets.checkLowStock(),
    };
  }
}
