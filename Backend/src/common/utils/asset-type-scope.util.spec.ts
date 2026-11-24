import { resolveAssetTypeScope } from './asset-type-scope.util';
import { UserRole, AssetType } from '../../../../packages/shared/src/enums';

describe('resolveAssetTypeScope', () => {
  it('retains the original IT scope for legacy accounts before migration', () => {
    expect(resolveAssetTypeScope(UserRole.IT_PERSONNEL)).toEqual([
      AssetType.ICT,
    ]);
  });

  it('retains the original property scope for legacy accounts before migration', () => {
    expect(resolveAssetTypeScope(UserRole.PROPERTY_CUSTODIAN)).toEqual([
      AssetType.FIXED,
      AssetType.SUPPLIES,
    ]);
  });

  it('gives the Asset Custodian all three inventory categories', () => {
    expect(resolveAssetTypeScope(UserRole.ASSET_CUSTODIAN)).toEqual([
      AssetType.ICT, AssetType.FIXED, AssetType.SUPPLIES,
    ]);
  });

  it('keeps the retired PROPERTY_OFFICER role scoped to Fixed and Supplies, never unscoped', () => {
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
