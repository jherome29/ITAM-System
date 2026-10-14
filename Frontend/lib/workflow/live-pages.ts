import { ProposedUserRole } from '@/lib/roles/proposed-roles';

// Aliases the role routers accept for a page, mapped to the page's real name.
const SLUG_ALIASES: Record<string, string> = {
  queue: 'approvals',
  history: 'approval-history',
  'custody-issuance': 'custody',
  inventory: 'physical-inventory',
  'reports-forms': 'reports',
  'registry-overview': 'assets',
  'disposal-review': 'disposal',
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
 * The pages WorkflowPage fills from the real API, per role. Anything else it
 * could render is hard-coded SAMPLE data (made-up "REQ-2025-0xx" requests,
 * "INV-001" counts) with action buttons that save nothing — so the role
 * routers refuse every page that is not listed here. Wire a page to the API,
 * then add it to this list.
 */
const LIVE_WORKFLOW_PAGES: Partial<Record<ProposedUserRole, readonly string[]>> = {
  [ProposedUserRole.APPROVING_OFFICER]: ['approvals', 'requisitions'],
  [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: ['audit'],
  [ProposedUserRole.IT_ASSET_CUSTODIAN]: ['fulfillment', 'custody', 'disposal', 'requisitions'],
  [ProposedUserRole.PROPERTY_CUSTODIAN]: ['fulfillment', 'custody', 'disposal'],
};

export function isLiveWorkflowPage(role: ProposedUserRole, slug: string): boolean {
  return LIVE_WORKFLOW_PAGES[role]?.includes(normalizeWorkflowSlug(slug)) ?? false;
}
