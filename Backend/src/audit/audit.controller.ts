import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';

// SVC: Improve — read-only audit trail access
// CRITICAL: This controller exposes NO write endpoints.
// The audit_logs table is APPEND-ONLY for COA compliance.

@Controller('v1/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  /**
   * GET /api/v1/audit
   * Full audit log — paginated, newest first.
   * Roles: System Admin, Management (read-only oversight)
   */
  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('action') action?: string,
  ) {
    const result = await this.svc.findAll(+page, +limit, action);
    return { message: 'Audit logs retrieved', data: result };
  }

  /**
   * GET /api/v1/audit/user/:userId
   * All audit entries for a specific user.
   * Roles: System Admin only
   */
  @Get('user/:userId')
  @Roles(UserRole.SYSTEM_ADMIN)
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const result = await this.svc.findByUser(userId, +page, +limit);
    return { message: 'User audit log retrieved', data: result };
  }

  /**
   * GET /api/v1/audit/record/:recordId
   * Full history of a specific record (asset, requisition, user, etc.).
   * Roles: System Admin, Management, IT Personnel
   */
  @Get('record/:recordId')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT, UserRole.IT_PERSONNEL)
  async findByRecord(@Param('recordId', ParseUUIDPipe) recordId: string) {
    const result = await this.svc.findByRecord(recordId);
    return { message: 'Record audit history retrieved', data: result };
  }
}
