// Keys/values must match the real (lowercase) AssetStatus enum in packages/shared/src/enums —
// the backend rejects any other casing via @IsEnum on UpdateLifecycleDto.
export const ASSET_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  registered: ['available'],
  available: ['issued', 'transferred', 'under_repair', 'flagged_for_disposal'],
  issued: ['returned', 'under_repair', 'flagged_for_disposal'],
  returned: ['available', 'under_repair'],
  transferred: ['available'],
  // 'issued' from under_repair = hand a repaired item back to the holder who
  // still carries it (the backend refuses it for anyone else / no holder).
  under_repair: ['issued', 'available', 'flagged_for_disposal'],
  flagged_for_disposal: ['disposed'],
  disposed: [],
};
