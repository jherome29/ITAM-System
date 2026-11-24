import { describe, expect, it } from 'vitest';
import { ASSET_LIFECYCLE_TRANSITIONS, lifecycleNotesRequired } from './lifecycle-transitions';

// Mirrors the backend's VALID_TRANSITIONS (assets.service.ts); the API refuses
// anything else, this table only decides which choices the modal offers.
describe('ASSET_LIFECYCLE_TRANSITIONS', () => {
  it('lets a flagged asset be disposed or restored to stock — and nothing else', () => {
    expect([...ASSET_LIFECYCLE_TRANSITIONS.flagged_for_disposal].sort()).toEqual(['available', 'disposed']);
  });

  it('keeps disposed terminal', () => {
    expect(ASSET_LIFECYCLE_TRANSITIONS.disposed).toEqual([]);
  });
});

// Flagging for disposal always needed a written justification; reversing the
// flag takes a written-off item (and the holder's relief) back, so it does too.
describe('lifecycleNotesRequired', () => {
  it('requires notes to flag an asset for disposal, from any status', () => {
    expect(lifecycleNotesRequired('available', 'flagged_for_disposal')).toBe(true);
    expect(lifecycleNotesRequired('issued', 'flagged_for_disposal')).toBe(true);
  });

  it('requires notes to restore a flagged asset to stock', () => {
    expect(lifecycleNotesRequired('flagged_for_disposal', 'available')).toBe(true);
  });

  it('does not require notes to dispose a flagged asset, or for ordinary moves', () => {
    expect(lifecycleNotesRequired('flagged_for_disposal', 'disposed')).toBe(false);
    expect(lifecycleNotesRequired('issued', 'returned')).toBe(false);
    expect(lifecycleNotesRequired('returned', 'available')).toBe(false);
    expect(lifecycleNotesRequired('under_repair', 'available')).toBe(false);
  });

  it('requires nothing before a target is chosen', () => {
    expect(lifecycleNotesRequired('flagged_for_disposal', '')).toBe(false);
  });
});
