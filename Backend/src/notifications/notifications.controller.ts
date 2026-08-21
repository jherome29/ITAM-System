import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';
import { UserEntity } from '../users/entities/user.entity';

interface AuthReq {
  user: UserEntity;
}

// All 7 roles can receive and manage their own notifications

@Controller('v1/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.EMPLOYEE,
  UserRole.SUPERVISOR,
  UserRole.IT_PERSONNEL,
  UserRole.SYSTEM_ADMIN,
  UserRole.MANAGEMENT,
  UserRole.PROPERTY_CUSTODIAN,
  UserRole.PROPERTY_OFFICER,
)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /**
   * GET /api/v1/notifications
   * Returns the authenticated user's last 50 notifications, newest first.
   */
  @Get()
  async findMine(@Req() req: AuthReq) {
    const notifications = await this.svc.findForUser(req.user.id);
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return {
      message: 'Notifications retrieved',
      data: { notifications, unreadCount },
    };
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a single notification as read.
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    await this.svc.markRead(id, req.user.id);
    return { message: 'Notification marked as read', data: null };
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all of the user's unread notifications as read.
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Req() req: AuthReq) {
    const result = await this.svc.markAllRead(req.user.id);
    return { message: 'All notifications marked as read', data: result };
  }
}
