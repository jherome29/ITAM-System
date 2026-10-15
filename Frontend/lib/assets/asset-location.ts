import type { Asset } from '@/lib/api/assets';

/**
 * Where an asset is, for a list column. A transferred asset keeps its old office
 * until it arrives, so the move is shown ("From → To") instead of leaving the
 * destination out of sight.
 */
export function locationLabel(asset: Pick<Asset, 'status' | 'officeOrSection' | 'officeLocation' | 'transferredTo'>): string {
  const where = asset.officeOrSection?.trim() || asset.officeLocation?.trim() || '';
  if (asset.status === 'transferred' && asset.transferredTo) {
    return where ? `${where} → ${asset.transferredTo}` : `→ ${asset.transferredTo}`;
  }
  return where || '—';
}
