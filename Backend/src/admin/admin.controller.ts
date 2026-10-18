import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';
import type { UserEntity } from '../users/entities/user.entity';

interface AuthenticatedRequest {
  user: UserEntity;
}

// SVC: Improve — KPI / audit-readiness read-out for the System Administrator.
// System-wide counters, so this is the one admin route gated to SYSTEM_ADMIN
// alone (Management gets its oversight numbers from the reports module).
@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard-stats')
  async dashboardStats(@Req() req: AuthenticatedRequest) {
    return {
      data: await this.admin.getDashboardStats(req.user),
      message: 'Admin dashboard statistics retrieved',
    };
  }
}
