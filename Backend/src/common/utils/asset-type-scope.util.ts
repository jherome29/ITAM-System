import { AssetType, UserRole } from '../../../../packages/shared/src/enums';

/**
 * Maps a requesting user's role to the AssetType values their asset queries
 * should be restricted to. Returns undefined for roles with no scope restriction.
 */
export function resolveAssetTypeScope(role: UserRole): AssetType[] | undefined {
  switch (role) {
    case UserRole.ASSET_CUSTODIAN:
    case UserRole.IT_PERSONNEL:
    case UserRole.PROPERTY_CUSTODIAN:
      return [AssetType.ICT, AssetType.FIXED, AssetType.SUPPLIES];
    case UserRole.PROPERTY_OFFICER:
      return [AssetType.FIXED, AssetType.SUPPLIES];
    default:
      return undefined;
  }
}
