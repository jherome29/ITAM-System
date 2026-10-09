// What the blue per-row action button does on a WorkflowPage table.
//   'confirm' — open the confirm dialog for that action directly.
//   'drawer'  — just open the record's detail drawer.
// On live pages where the row button's label ('Review', 'Open') has no backend
// action, a confirm dialog would only run the mock handler and save nothing,
// so the button opens the drawer, where the real decisions live.
const LIVE_DRAWER_SLUGS = new Set(['approvals', 'requisitions']);

export function rowActionMode(slug: string, isLive: boolean): 'confirm' | 'drawer' {
  return isLive && LIVE_DRAWER_SLUGS.has(slug) ? 'drawer' : 'confirm';
}
