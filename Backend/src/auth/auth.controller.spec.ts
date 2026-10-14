import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';

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
