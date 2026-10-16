import * as fs from 'fs';
import * as path from 'path';
import { ROLES_KEY } from './decorators/roles.decorator';
import {
  ASSIGNABLE_USER_ROLES,
  UserRole,
} from '../../../packages/shared/src/enums';
import { resolveAssetTypeScope } from './utils/asset-type-scope.util';
import { AssetType } from '../../../packages/shared/src/enums';

// The Property Officer was a read-only subset of the Property Custodian, so the
// two roles were merged (2026-10). The value stays in the enum because the
// database enum cannot drop it and old audit rows still carry it, but nothing may
// grant it access, and no one may be given it.

const controllerFiles = (dir: string): string[] =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the test walks this repo's own source tree
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return controllerFiles(full);
    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });

type Controller = { name: string; prototype: Record<string, unknown> };

const controllers = (): Controller[] =>
  controllerFiles(path.join(__dirname, '..')).flatMap((file) =>
    Object.values(jest.requireActual<Record<string, unknown>>(file)).filter(
      (exported): exported is Controller =>
        typeof exported === 'function' && exported.name.endsWith('Controller'),
    ),
  );

describe('the retired Property Officer role', () => {
  it('is not granted access by any controller route', () => {
    const offenders: string[] = [];
    for (const controller of controllers()) {
      const grants = (target: unknown) =>
        (Reflect.getMetadata(ROLES_KEY, target as object) as
          | UserRole[]
          | undefined) ?? [];
      if (grants(controller).includes(UserRole.PROPERTY_OFFICER)) {
        offenders.push(controller.name);
      }
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (
          name !== 'constructor' &&
          typeof handler === 'function' &&
          grants(handler).includes(UserRole.PROPERTY_OFFICER)
        ) {
          offenders.push(`${controller.name}.${name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('really scanned the controllers (a vacuous pass would prove nothing)', () => {
    const names = controllers().map((c) => c.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'AssetsController',
        'RequisitionsController',
        'ReportsController',
        'AuditController',
        'UsersController',
      ]),
    );
  });

  it('cannot be assigned: it is the only role left out of ASSIGNABLE_USER_ROLES', () => {
    expect(ASSIGNABLE_USER_ROLES).not.toContain(UserRole.PROPERTY_OFFICER);
    expect([...ASSIGNABLE_USER_ROLES].sort()).toEqual(
      Object.values(UserRole)
        .filter((role) => role !== UserRole.PROPERTY_OFFICER)
        .sort(),
    );
  });

  it('still never resolves to an unscoped view of every asset', () => {
    // An account that somehow kept the role would be refused by every guard, but
    // the scope helper must not fail open either.
    expect(resolveAssetTypeScope(UserRole.PROPERTY_OFFICER)).toEqual([
      AssetType.FIXED,
      AssetType.SUPPLIES,
    ]);
  });
});
