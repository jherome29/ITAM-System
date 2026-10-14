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
  // 'available' reverses the flag (found after being reported lost, or flagged in
  // error) and needs a written reason — see lifecycleNotesRequired.
  flagged_for_disposal: ['disposed', 'available'],
  disposed: [],
};

/**
 * Whether moving an asset from `from` to `to` needs a written justification:
 * flagging it for disposal, and reversing that flag (restoring it to stock).
 * The API enforces the same rule; this only keeps Confirm disabled until the
 * reason is typed.
 */
export function lifecycleNotesRequired(from: string, to: string): boolean {
  if (to === 'flagged_for_disposal') return true;
  return from === 'flagged_for_disposal' && to === 'available';
}
