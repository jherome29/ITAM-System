import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequisitionsController } from './requisitions.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { UserRole } from '../../../packages/shared/src/enums';

describe('RequisitionsController — the approver decision history route', () => {
  const prototype = RequisitionsController.prototype as unknown as Record<
    string,
    () => unknown
  >;
  const routeOf = (name: string) => ({
    path: Reflect.getMetadata(PATH_METADATA, prototype[name]) as string,
    method: Reflect.getMetadata(METHOD_METADATA, prototype[name]) as number,
    roles: Reflect.getMetadata(ROLES_KEY, prototype[name]) as UserRole[],
  });

  it('is GET /requisitions/decided, for approvers only (a supervisor, or the System Administrator who can approve too)', () => {
    const route = routeOf('findDecided');
    expect(route.path).toBe('decided');
    expect(route.method).toBe(RequestMethod.GET);
    expect([...route.roles].sort()).toEqual(
      [UserRole.SUPERVISOR, UserRole.SYSTEM_ADMIN].sort(),
    );
  });

  // `GET :id` would swallow "decided" as a UUID (and 400) if it were declared first.
  it('is declared before GET :id, so the literal path is not parsed as an id', () => {
    const order = Object.getOwnPropertyNames(RequisitionsController.prototype);
    expect(order.indexOf('findDecided')).toBeGreaterThan(-1);
    expect(order.indexOf('findDecided')).toBeLessThan(order.indexOf('findOne'));
  });

  it("asks the service for the CALLER's own decisions, with the page and limit", async () => {
    const findDecidedBy = jest
      .fn()
      .mockResolvedValue({ data: [], total: 0, page: 3, limit: 25 });
    const controller = new RequisitionsController({
      findDecidedBy,
    } as never);

    const res = await controller.findDecided(
      { user: { id: 'sup-1', role: UserRole.SUPERVISOR } } as never,
      3,
      25,
    );

    expect(findDecidedBy).toHaveBeenCalledWith('sup-1', 3, 25);
    expect(res.data).toMatchObject({ total: 0 });
  });
});
