import { ProposedUserRole } from '@/lib/roles/proposed-roles';

// Aliases the role routers accept for a page, mapped to the page's real name.
const SLUG_ALIASES: Record<string, string> = {
  queue: 'approvals',
  history: 'approval-history',
  'custody-issuance': 'custody',
  inventory: 'physical-inventory',
  'reports-forms': 'reports',
  'registry-overview': 'assets',
  'audit-history': 'audit',
  'audit-log': 'audit',
  'forms-archive': 'forms',
  'maintenance-disposal-reports': 'maintenance-disposal',
  'physical-count-reports': 'physical-count',
  'org-units': 'organizational-units',
  'approval-config': 'approval-configuration',
};

export function normalizeWorkflowSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug;
}

/**
 * The pages WorkflowPage serves, per role. Every one reads real records and every
 * action on it saves. The role routers refuse anything not listed here, so an
 * address with no real screen behind it is "not found" - never a made-up page.
 * Wire a page to the API, then add it to this list.
 */
const LIVE_WORKFLOW_PAGES: Partial<Record<ProposedUserRole, readonly string[]>> = {
  [ProposedUserRole.APPROVING_OFFICER]: ['approvals', 'requisitions'],
  [ProposedUserRole.IT_ASSET_CUSTODIAN]: ['fulfillment', 'custody', 'disposal', 'requisitions'],
  [ProposedUserRole.PROPERTY_CUSTODIAN]: ['fulfillment', 'custody', 'disposal', 'requisitions'],
  // A custodian cannot fulfil their own requisition; the administrator does.
  [ProposedUserRole.MASTER_ADMIN]: ['fulfillment'],
};

export function isLiveWorkflowPage(role: ProposedUserRole, slug: string): boolean {
  return LIVE_WORKFLOW_PAGES[role]?.includes(normalizeWorkflowSlug(slug)) ?? false;
}
