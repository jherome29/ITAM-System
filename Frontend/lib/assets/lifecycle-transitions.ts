// Keys/values must match the real (lowercase) AssetStatus enum in packages/shared/src/enums —
// the backend rejects any other casing via @IsEnum on UpdateLifecycleDto.
export const ASSET_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  registered: ['available'],
  available: ['issued', 'transferred', 'under_repair', 'flagged_for_disposal'],
  issued: ['returned', 'under_repair', 'flagged_for_disposal'],
  returned: ['available', 'under_repair'],
  transferred: ['available'],
  under_repair: ['available', 'flagged_for_disposal'],
  flagged_for_disposal: ['disposed'],
  disposed: [],
};
