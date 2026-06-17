import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — shorthand guard for @UseGuards(JwtAuthGuard).
 * Always pair with RolesGuard for protected routes:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.IT_PERSONNEL)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
