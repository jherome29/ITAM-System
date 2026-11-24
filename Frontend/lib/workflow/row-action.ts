// What the blue per-row action button does on a WorkflowPage table.
//   'confirm' — open the confirm dialog for that action directly.
//   'drawer'  — just open the record's detail drawer.
// On pages where the row button's label ('Review', 'Open') has no backend action
// of its own, a confirm dialog would have nothing real to run, so the button
// opens the drawer, where the real decisions live.
// Custody is here too: which actions apply depends on the asset's status, and the
// row button used to offer Issue on an asset that was already issued.
const DRAWER_SLUGS = new Set(['approvals', 'requisitions', 'custody']);

export function rowActionMode(slug: string): 'confirm' | 'drawer' {
  return DRAWER_SLUGS.has(slug) ? 'drawer' : 'confirm';
}
