import { ASSET_COST_THRESHOLDS } from "../constants";
import { AssetClass, AssetType } from "../enums";

/**
 * Registration policy: ICT/Fixed represent reusable property with useful life
 * over one year; Supplies represent consumables. Compare unit acquisition cost,
 * never the quantity multiplied by cost (COA Circular 2022-004, section 3.1).
 */
export function classifyRegisteredAsset(
  assetType: string,
  unitCost?: number,
): AssetClass | undefined {
  if (assetType === AssetType.SUPPLIES) return AssetClass.IES;
  if (assetType !== AssetType.ICT && assetType !== AssetType.FIXED)
    return undefined;
  if (unitCost === undefined || !Number.isFinite(unitCost) || unitCost <= 0) {
    return undefined;
  }
  return unitCost >= ASSET_COST_THRESHOLDS.PPE_MINIMUM
    ? AssetClass.PPE
    : AssetClass.SEP;
}
