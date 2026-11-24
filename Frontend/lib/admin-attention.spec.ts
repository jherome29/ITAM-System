import { describe, expect, it } from 'vitest';
import { attentionPanelState } from './admin-attention';

// The admin dashboard's "Items needing attention" panel built its list from the
// statistics, and an empty list meant "all clear". When the statistics call
// failed (an employee opening /master-admin, an unreachable API) the list was
// empty for the wrong reason, and the page showed a red "could not load" error
// directly above a green "No administrative items need attention right now."
describe('attentionPanelState', () => {
  it('shows a placeholder while loading', () => {
    expect(attentionPanelState(true, false, 0)).toBe('loading');
    expect(attentionPanelState(true, true, 3)).toBe('loading');
  });

  it('never says "all clear" when the statistics did not load', () => {
    expect(attentionPanelState(false, false, 0)).toBe('unavailable');
  });

  it('says "all clear" only when the statistics loaded and there is nothing to flag', () => {
    expect(attentionPanelState(false, true, 0)).toBe('clear');
  });

  it('lists the items when there are some', () => {
    expect(attentionPanelState(false, true, 2)).toBe('items');
  });
});
