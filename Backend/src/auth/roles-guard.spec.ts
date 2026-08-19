import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '../../../packages/shared/src/enums';

// ── Helper — build a mock ExecutionContext ────────────────────────────────────
const makeCtx = (role: UserRole | undefined): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  }) as unknown as ExecutionContext;

// ── Section 12.2 — RBAC enforcement tests ────────────────────────────────────
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  // ── Correct role — allow ─────────────────────────────────────────────────
  it('allows access when user has the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.IT_PERSONNEL]);
    expect(guard.canActivate(makeCtx(UserRole.IT_PERSONNEL))).toBe(true);
  });

  // ── No roles required (e.g. public endpoint) — allow ────────────────────
  it('allows all requests when no roles are decorated', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    expect(guard.canActivate(makeCtx(UserRole.EMPLOYEE))).toBe(true);
  });

  // ── Wrong role — deny (ForbiddenException) ───────────────────────────────
  it('throws ForbiddenException when user does not have the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.IT_PERSONNEL]);
    expect(() => guard.canActivate(makeCtx(UserRole.EMPLOYEE))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when EMPLOYEE hits approve endpoint', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.SUPERVISOR, UserRole.SYSTEM_ADMIN]);
    expect(() => guard.canActivate(makeCtx(UserRole.EMPLOYEE))).toThrow(
      ForbiddenException,
    );
  });

  it('allows SUPERVISOR on approve endpoint', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.SUPERVISOR, UserRole.SYSTEM_ADMIN]);
    expect(guard.canActivate(makeCtx(UserRole.SUPERVISOR))).toBe(true);
  });

  // ── Unauthenticated (no user on request) — deny ──────────────────────────
  it('throws ForbiddenException for unauthenticated requests', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.IT_PERSONNEL]);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(
      ForbiddenException,
    );
  });

  // ── All non-IT roles denied on IT-only endpoint ──────────────────────────
  const nonItRoles = Object.values(UserRole).filter(
    (r) => r !== UserRole.IT_PERSONNEL,
  );

  test.each(nonItRoles)(
    '%s is denied on IT_PERSONNEL-only endpoint',
    (role) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.IT_PERSONNEL]);
      expect(() => guard.canActivate(makeCtx(role))).toThrow(
        ForbiddenException,
      );
    },
  );

  // ── MANAGEMENT role allowed on multi-role endpoint ──────────────────────
  it('allows MANAGEMENT on multi-role endpoint', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.MANAGEMENT, UserRole.SYSTEM_ADMIN]);
    expect(guard.canActivate(makeCtx(UserRole.MANAGEMENT))).toBe(true);
  });

  // ── Property Custodian / Property Officer grants ─────────────────────────
  it('allows PROPERTY_CUSTODIAN on an IT_PERSONNEL+PROPERTY_CUSTODIAN endpoint', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN]);
    expect(guard.canActivate(makeCtx(UserRole.PROPERTY_CUSTODIAN))).toBe(true);
  });

  it('denies PROPERTY_OFFICER on a mutating endpoint that only lists IT_PERSONNEL and PROPERTY_CUSTODIAN', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.IT_PERSONNEL, UserRole.PROPERTY_CUSTODIAN]);
    expect(() => guard.canActivate(makeCtx(UserRole.PROPERTY_OFFICER))).toThrow(
      ForbiddenException,
    );
  });

  it('allows PROPERTY_OFFICER on a read endpoint that lists it explicitly', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([
        UserRole.IT_PERSONNEL,
        UserRole.SYSTEM_ADMIN,
        UserRole.MANAGEMENT,
        UserRole.PROPERTY_CUSTODIAN,
        UserRole.PROPERTY_OFFICER,
      ]);
    expect(guard.canActivate(makeCtx(UserRole.PROPERTY_OFFICER))).toBe(true);
  });

  // ── Fix 3 — POST /v1/reports/forms/generate deliberately omits PROPERTY_OFFICER ──
  // Property Officer is read-only by omission from every mutating route's guard
  // list (see reports.controller.ts). This asserts that omission actually denies
  // access, so the invariant can't silently regress if the guard list is edited.
  it('denies PROPERTY_OFFICER on the reports/forms/generate guard list (IT_PERSONNEL, SYSTEM_ADMIN, PROPERTY_CUSTODIAN)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([
        UserRole.IT_PERSONNEL,
        UserRole.SYSTEM_ADMIN,
        UserRole.PROPERTY_CUSTODIAN,
      ]);
    expect(() => guard.canActivate(makeCtx(UserRole.PROPERTY_OFFICER))).toThrow(
      ForbiddenException,
    );
  });
});
