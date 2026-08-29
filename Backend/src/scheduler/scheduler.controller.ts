import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';
import { SchedulerService, CheckSummary } from './scheduler.service';

// SVC: Engage — on-demand trigger for the four automated notification watchers.
// Demo / testing hook: lets a System Administrator run all watchers immediately
// instead of waiting for the hourly / daily @Cron cadence.

@Controller('v1/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Post('run-checks')
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async runChecks(): Promise<{ data: CheckSummary; message: string }> {
    const data = await this.scheduler.runAllChecks();
    return { data, message: 'Notification checks executed' };
  }
}
