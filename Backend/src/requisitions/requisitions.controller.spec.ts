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

// Who may ask for things. Holding property does not make someone a requester:
// the Property Custodian files requisitions like the employee they are, but
// Management (read-only oversight) and the System Administrator (a privileged
// system role that can approve any requisition) do not.
describe('RequisitionsController - who may file and who may fulfil', () => {
  const prototype = RequisitionsController.prototype as unknown as Record<
    string,
    () => unknown
  >;
  const rolesOf = (name: string) =>
    [...(Reflect.getMetadata(ROLES_KEY, prototype[name]) as UserRole[])].sort();

  it('lets the employee-side roles file a requisition, including the Property Custodian', () => {
    expect(rolesOf('create')).toEqual(
      [
        UserRole.EMPLOYEE,
        UserRole.SUPERVISOR,
        UserRole.IT_PERSONNEL,
        UserRole.PROPERTY_CUSTODIAN,
      ].sort(),
    );
  });

  it('keeps Management and the System Administrator from filing one', () => {
    expect(rolesOf('create')).not.toContain(UserRole.MANAGEMENT);
    expect(rolesOf('create')).not.toContain(UserRole.SYSTEM_ADMIN);
  });

  it.each(['fulfill', 'putOnHold'])(
    '%s is for the custodians, and the System Administrator as their fallback',
    (name) => {
      expect(rolesOf(name)).toEqual(
        [
          UserRole.IT_PERSONNEL,
          UserRole.PROPERTY_CUSTODIAN,
          UserRole.SYSTEM_ADMIN,
        ].sort(),
      );
    },
  );

  it("lists the custodians' own requisitions for the System Administrator only", () => {
    expect(rolesOf('findFulfilmentFallback')).toEqual([UserRole.SYSTEM_ADMIN]);
    const route = Reflect.getMetadata(
      PATH_METADATA,
      prototype['findFulfilmentFallback'],
    ) as string;
    expect(route).toBe('fulfilment-fallback');
  });

  // `GET :id` would swallow the literal path as a UUID (and 400) if declared first.
  it('declares the fallback route before GET :id', () => {
    const order = Object.getOwnPropertyNames(RequisitionsController.prototype);
    expect(order.indexOf('findFulfilmentFallback')).toBeGreaterThan(-1);
    expect(order.indexOf('findFulfilmentFallback')).toBeLessThan(
      order.indexOf('findOne'),
    );
  });
});
