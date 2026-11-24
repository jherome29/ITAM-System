import { resolveAssetTypeScope } from './asset-type-scope.util';
import { UserRole, AssetType } from '../../../../packages/shared/src/enums';

describe('resolveAssetTypeScope', () => {
  it('gives existing IT accounts all inventory categories', () => {
    expect(resolveAssetTypeScope(UserRole.IT_PERSONNEL)).toEqual([
      AssetType.ICT,
      AssetType.FIXED,
      AssetType.SUPPLIES,
    ]);
  });

  it('gives existing property custodian accounts all inventory categories', () => {
    expect(resolveAssetTypeScope(UserRole.PROPERTY_CUSTODIAN)).toEqual([
      AssetType.ICT,
      AssetType.FIXED,
      AssetType.SUPPLIES,
    ]);
  });

  it('scopes PROPERTY_OFFICER to Fixed and Supplies', () => {
    expect(resolveAssetTypeScope(UserRole.PROPERTY_OFFICER)).toEqual([
      AssetType.FIXED,
      AssetType.SUPPLIES,
    ]);
  });

  it('leaves SYSTEM_ADMIN unscoped', () => {
    expect(resolveAssetTypeScope(UserRole.SYSTEM_ADMIN)).toBeUndefined();
  });

  it('leaves MANAGEMENT unscoped', () => {
    expect(resolveAssetTypeScope(UserRole.MANAGEMENT)).toBeUndefined();
  });
});
