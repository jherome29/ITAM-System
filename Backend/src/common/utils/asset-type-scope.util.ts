import { AssetType, UserRole } from '../../../../packages/shared/src/enums';

/**
 * Maps a requesting user's role to the AssetType values their asset queries
 * should be restricted to. Returns undefined for roles with no scope restriction.
 */
export function resolveAssetTypeScope(role: UserRole): AssetType[] | undefined {
  switch (role) {
    case UserRole.IT_PERSONNEL:
      return [AssetType.ICT];
    // PROPERTY_OFFICER is the retired role (merged into the custodian). No route
    // grants it, but an account that somehow kept it must never resolve to
    // "unscoped" and see every asset.
    case UserRole.PROPERTY_CUSTODIAN:
    case UserRole.PROPERTY_OFFICER:
      return [AssetType.FIXED, AssetType.SUPPLIES];
    default:
      return undefined;
  }
}
