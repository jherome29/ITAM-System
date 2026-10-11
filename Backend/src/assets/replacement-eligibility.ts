import {
  AssetClass,
  AssetCondition,
  AssetStatus,
} from '../../../packages/shared/src/enums';
import type { AssetEntity } from './entities/asset.entity';

// SVC: Design & Transition — replacement validation (CLAUDE.md §17). One rule
// set shared by the requisition guard (RequisitionsService.create) and the
// holder's "My Assigned Assets" view, so the button and the API never disagree.

export type ReplacementBasis = 'condition' | 'useful_life' | 'loss_or_damage';

export interface ReplacementEligibility {
  eligible: boolean;
  basis: ReplacementBasis | null;
  /** Why it is (or is not) replaceable — shown to the holder as-is. */
  reason: string;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1_000;

/**
 * Whether the holder may requisition a replacement for `asset`. The caller has
 * already established that the holder is the asset's current custodian.
 *
 *   - flagged for disposal while still held → loss / theft / damage reported
 *   - issued and no longer serviceable       → condition
 *   - issued and past its class's useful life → useful_life
 *
 * Anything else (serviceable and young, under repair, …) is not replaceable.
 */
export function replacementEligibility(
  asset: Pick<
    AssetEntity,
    'status' | 'condition' | 'acquisitionDate' | 'assetClass'
  >,
  usefulLifeYears: Record<AssetClass, number>,
  now = Date.now(),
): ReplacementEligibility {
  if (asset.status === AssetStatus.FLAGGED_FOR_DISPOSAL) {
    return {
      eligible: true,
      basis: 'loss_or_damage',
      reason: 'Reported lost, stolen or damaged beyond repair.',
    };
  }
  if (asset.status === AssetStatus.UNDER_REPAIR) {
    return {
      eligible: false,
      basis: null,
      reason:
        'Under repair — a replacement can be requested if the repair fails.',
    };
  }
  if (asset.status !== AssetStatus.ISSUED) {
    return {
      eligible: false,
      basis: null,
      reason: 'Only an asset currently issued to you can be replaced.',
    };
  }
  if (asset.condition !== AssetCondition.SERVICEABLE) {
    return {
      eligible: true,
      basis: 'condition',
      reason: `Condition is "${String(asset.condition).replaceAll('_', ' ')}".`,
    };
  }

  const usefulLife = usefulLifeYears[asset.assetClass];
  if (!asset.acquisitionDate) {
    return {
      eligible: false,
      basis: null,
      reason:
        'Serviceable, and no acquisition date is recorded to measure its useful life.',
    };
  }
  const acquired = new Date(asset.acquisitionDate);
  if ((now - acquired.getTime()) / MS_PER_YEAR >= usefulLife) {
    return {
      eligible: true,
      basis: 'useful_life',
      reason: `Past its ${usefulLife}-year useful life for ${asset.assetClass}.`,
    };
  }
  return {
    eligible: false,
    basis: null,
    reason:
      `Serviceable and within its useful life (acquired ` +
      `${acquired.toISOString().slice(0, 10)}; ${usefulLife}-year threshold ` +
      `for ${asset.assetClass}). Report damage or request a repair first if it is faulty.`,
  };
}
