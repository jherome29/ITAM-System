import type { Asset } from '@/lib/api/assets';

/**
 * Where an asset is, for a list column, a drawer or a card: the office or section
 * and the room, whichever are recorded. One label everywhere - the custody and
 * disposal screens used to show only the office while My Assigned Assets showed
 * only the room, so "Location" meant two things for the same asset.
 *
 * A transferred asset keeps its old office until it arrives, so the move is
 * shown ("From → To") instead of leaving the destination out of sight.
 */
export function locationLabel(asset: Pick<Asset, 'status' | 'officeOrSection' | 'officeLocation' | 'transferredTo'>): string {
  const office = asset.officeOrSection?.trim() ?? '';
  const room = asset.officeLocation?.trim() ?? '';
  const where = office && room && office.toLowerCase() !== room.toLowerCase() ? `${office} · ${room}` : office || room;
  if (asset.status === 'transferred' && asset.transferredTo) {
    return where ? `${where} → ${asset.transferredTo}` : `→ ${asset.transferredTo}`;
  }
  return where || '—';
}
