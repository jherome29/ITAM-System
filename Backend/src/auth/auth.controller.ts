import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';

// SVC: Design & Transition — single unified login, role-based redirect
// All responses use the { statusCode, message, data } envelope via ResponseInterceptor

const ALL_ROLES = [
  UserRole.EMPLOYEE,
  UserRole.SUPERVISOR,
  UserRole.IT_PERSONNEL,
  UserRole.SYSTEM_ADMIN,
  UserRole.MANAGEMENT,
  UserRole.PROPERTY_CUSTODIAN,
  UserRole.PROPERTY_OFFICER,
];

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/login
   *
   * Returns JWT access token + sanitized user profile.
   * Also sets refresh_token httpOnly cookie (7-day, single-use rotation).
   * Rate limited to 10 requests/minute per IP (SECURITY.md §3).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    const result = await this.authService.login(
      dto.emailOrEmployeeId,
      dto.password,
      ipAddress,
      res,
    );
    return {
      message: 'Login successful',
      data: result,
    };
  }

  /**
   * POST /api/v1/auth/refresh
   *
   * Uses the refresh_token httpOnly cookie to issue a new access token.
   * No JWT guard — access token may be expired when this is called.
   * Cookie path is restricted to this endpoint only.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieValue = (req.cookies as Record<string, string>)[
      'refresh_token'
    ];
    if (!cookieValue) throw new UnauthorizedException();

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    const result = await this.authService.rotateRefreshToken(
      cookieValue,
      ipAddress,
      res,
    );
    return { message: 'Token refreshed', data: result };
  }

  /**
   * POST /api/v1/auth/logout
   *
   * Clears the refresh token from DB and deletes the httpOnly cookie.
   * Accessible by all authenticated roles.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  async logout(
    @Req() req: Request & { user: { sub: string; role: UserRole } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    await this.authService.logout(req.user.sub, req.user.role, ipAddress, res);
    return { message: 'Logged out successfully', data: null };
  }

  /**
   * GET /api/v1/auth/profile
   * Returns the authenticated user's profile. Accessible by all roles.
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_ROLES)
  getProfile(@Req() req: { user: Record<string, unknown> }) {
    return {
      message: 'Profile retrieved',
      data: req.user,
    };
  }

  // ─── Demo endpoints for RBAC pattern documentation ────────────────────

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  adminDemo() {
    return {
      message: 'Admin access confirmed',
      data: {
        note: 'Only SYSTEM_ADMIN reaches this endpoint. All others receive 403 Forbidden.',
        pattern:
          '@UseGuards(JwtAuthGuard, RolesGuard) + @Roles(UserRole.SYSTEM_ADMIN)',
      },
    };
  }

  @Get('it-and-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN)
  itAndAdminDemo() {
    return {
      message: 'IT Personnel or Admin access confirmed',
      data: {
        note: 'Accessible by IT_PERSONNEL and SYSTEM_ADMIN. Others receive 403.',
        pattern: '@Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN)',
      },
    };
  }

  @Get('read-only-roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT, UserRole.IT_PERSONNEL)
  readOnlyRolesDemo() {
    return {
      message: 'Read-only roles access confirmed',
      data: {
        note: 'Dashboard/report pattern — IT_PERSONNEL, SYSTEM_ADMIN, MANAGEMENT.',
        pattern:
          '@Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN, UserRole.MANAGEMENT)',
      },
    };
  }
}
