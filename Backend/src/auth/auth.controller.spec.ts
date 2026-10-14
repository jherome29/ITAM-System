import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import type { Request, Response } from 'express';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import { UserRole } from '../../../packages/shared/src/enums';

// The controller used to carry three "demo" endpoints (GET admin-only,
// it-and-admin, read-only-roles) that only existed to illustrate the @Roles
// pattern. They returned the decorator source text in their responses
// ("pattern: '@UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...)'") and nothing
// used them. Pinning the exact route list means scaffolding like that cannot
// creep back in unnoticed: adding an auth route has to be a deliberate edit
// of this test.
describe('AuthController route surface', () => {
  const prototype = AuthController.prototype as unknown as Record<
    string,
    () => unknown
  >;

  const routes = Object.getOwnPropertyNames(AuthController.prototype)
    .filter((name) => name !== 'constructor')
    .flatMap((name) => {
      const handler = prototype[name];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as
        | string
        | undefined;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      return path === undefined || method === undefined
        ? []
        : [`${RequestMethod[method]} ${path}`];
    })
    .sort();

  it('exposes exactly login, refresh, logout and profile — no RBAC demo endpoints', () => {
    expect(routes).toEqual([
      'GET profile',
      'POST login',
      'POST logout',
      'POST refresh',
    ]);
  });
});

// Login, refresh and logout took the audit-trail IP from the FIRST entry of the
// client-supplied X-Forwarded-For header. Directly exposed, anyone could write a
// forged address into the audit log - including onto failed-login rows - and
// behind a proxy that appends the real address the first entry is still
// whatever the client sent. main.ts sets Express's "trust proxy" precisely so
// req.ip is right (and spoof-proof when no proxy is configured); these handlers
// bypassed it.
describe('AuthController - client IP written to the audit trail', () => {
  const authService = {
    login: jest.fn().mockResolvedValue({}),
    rotateRefreshToken: jest.fn().mockResolvedValue({}),
    logout: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new AuthController(authService as unknown as AuthService);
  const res = {} as Response;

  const request = (over: object = {}) =>
    ({
      ip: '203.0.113.9', // what Express resolved, honouring TRUST_PROXY
      headers: { 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }, // client-controlled
      socket: { remoteAddress: '10.0.0.1' },
      cookies: { refresh_token: 'user-1:raw-token' },
      user: { id: 'user-1', role: UserRole.EMPLOYEE },
      ...over,
    }) as unknown as Request & { user: { id: string; role: UserRole } };

  beforeEach(() => jest.clearAllMocks());

  it('login records the address Express resolved, not the X-Forwarded-For header', async () => {
    await controller.login(
      { emailOrEmployeeId: 'a@b.c', password: 'x' },
      request(),
      res,
    );
    expect(authService.login).toHaveBeenCalledWith(
      'a@b.c',
      'x',
      '203.0.113.9',
      res,
    );
  });

  it('refresh records the address Express resolved', async () => {
    await controller.refresh(request(), res);
    expect(authService.rotateRefreshToken).toHaveBeenCalledWith(
      'user-1:raw-token',
      '203.0.113.9',
      res,
    );
  });

  it('logout records the address Express resolved', async () => {
    await controller.logout(request(), res);
    expect(authService.logout).toHaveBeenCalledWith(
      'user-1',
      UserRole.EMPLOYEE,
      '203.0.113.9',
      res,
    );
  });

  it('falls back to the socket address, then "unknown", when Express resolved none', async () => {
    await controller.refresh(request({ ip: undefined }), res);
    expect(authService.rotateRefreshToken).toHaveBeenLastCalledWith(
      'user-1:raw-token',
      '10.0.0.1',
      res,
    );

    await controller.refresh(
      request({ ip: undefined, socket: { remoteAddress: undefined } }),
      res,
    );
    expect(authService.rotateRefreshToken).toHaveBeenLastCalledWith(
      'user-1:raw-token',
      'unknown',
      res,
    );
  });
});
