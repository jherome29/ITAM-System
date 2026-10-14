export type AttentionPanelState = 'loading' | 'unavailable' | 'clear' | 'items';

/**
 * What the admin dashboard's "Items needing attention" panel shows. An empty
 * list only means "all clear" when it was built from real statistics: with the
 * statistics call failed it is empty for the wrong reason, and claiming
 * "No administrative items need attention" next to a "could not load" error is
 * false reassurance.
 */
export function attentionPanelState(
  loading: boolean,
  statsLoaded: boolean,
  itemCount: number,
): AttentionPanelState {
  if (loading) return 'loading';
  if (!statsLoaded) return 'unavailable';
  return itemCount === 0 ? 'clear' : 'items';
}
