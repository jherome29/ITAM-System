import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../../packages/shared/src/enums';

export const ROLES_KEY = 'roles';

/**
 * Decorator to declare which roles are permitted on a route.
 * Usage: @Roles(UserRole.IT_PERSONNEL, UserRole.SYSTEM_ADMIN)
 *
 * SVC: Design & Transition — Principle of Least Privilege enforcement
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
