import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../../packages/shared/src/enums';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

/**
 * RolesGuard — enforces RBAC at the NestJS controller level.
 *
 * IMPORTANT: Frontend role-checks are UX convenience only.
 * This guard is the authoritative security boundary.
 * Every protected route MUST have @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...)
 *
 * SVC: Design & Transition — RBAC enforcement, Security by Design
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator means the route is unrestricted (e.g. public health check)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role: UserRole } }>();

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
