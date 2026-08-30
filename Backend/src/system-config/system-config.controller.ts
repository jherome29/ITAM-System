import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SystemConfigService } from './system-config.service';
import { CONFIG_KEYS } from './system-config.keys';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserRole } from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

type AuthReq = Request & { user: UserEntity };

const FIELD_TO_KEY: Record<keyof UpdateSystemConfigDto, string> = {
  slaApprovalHours: CONFIG_KEYS.SLA_APPROVAL_HOURS,
  defaultReorderLevel: CONFIG_KEYS.DEFAULT_REORDER_LEVEL,
  maxLoginAttempts: CONFIG_KEYS.MAX_LOGIN_ATTEMPTS,
  usefulLifeYears: CONFIG_KEYS.USEFUL_LIFE_YEARS,
};

// SVC: Plan — System Administrator manages runtime configuration.
@Controller('v1/system-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN)
export class SystemConfigController {
  constructor(
    private readonly svc: SystemConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  getAll() {
    return {
      data: this.svc.getAll(),
      message: 'System configuration retrieved',
    };
  }

  @Patch()
  async update(@Body() dto: UpdateSystemConfigDto, @Req() req: AuthReq) {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined) as [
      keyof UpdateSystemConfigDto,
      unknown,
    ][];
    if (entries.length === 0) {
      throw new BadRequestException('No configuration fields provided');
    }

    for (const [field, value] of entries) {
      await this.svc.update(FIELD_TO_KEY[field], value, req.user.id);
    }

    await this.audit.log({
      userId: req.user.id,
      userRole: req.user.role,
      action: AuditAction.SYSTEM_CONFIG_UPDATED,
      affectedRecordId: req.user.id,
      affectedRecordType: 'system_config',
      ipAddress: req.ip ?? '',
      metadata: {
        changed: entries.map(([f]) => FIELD_TO_KEY[f]),
        values: Object.fromEntries(
          entries.map(([f, v]) => [FIELD_TO_KEY[f], v]),
        ),
      },
    });

    return {
      data: this.svc.getAll(),
      message: 'System configuration updated',
    };
  }
}
