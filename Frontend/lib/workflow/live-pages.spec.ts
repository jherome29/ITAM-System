import { describe, expect, it } from 'vitest';
import { ProposedUserRole as Role } from '@/lib/roles/proposed-roles';
import { isLiveWorkflowPage, normalizeWorkflowSlug } from './live-pages';

// WorkflowPage used to fall back to hard-coded SAMPLE rows for any role/page it was
// not wired to the API for, and the role routers handed it every unknown address - so
// /property-officer/corrections showed made-up "REQ-2025-015" requests with a
// working-looking "Approve Correction" button that saved nothing. The sample data is
// gone and pages that are not live are "not found"; this list keeps that honest.
describe('normalizeWorkflowSlug', () => {
  it('resolves the aliases the routers accept', () => {
    expect(normalizeWorkflowSlug('queue')).toBe('approvals');
    expect(normalizeWorkflowSlug('history')).toBe('approval-history');
    expect(normalizeWorkflowSlug('inventory')).toBe('physical-inventory');
    expect(normalizeWorkflowSlug('disposal-review')).toBe('disposal');
    expect(normalizeWorkflowSlug('audit-history')).toBe('audit');
  });

  it('leaves any other slug alone', () => {
    expect(normalizeWorkflowSlug('approvals')).toBe('approvals');
    expect(normalizeWorkflowSlug('something-new')).toBe('something-new');
  });
});

describe('isLiveWorkflowPage — pages that read real records', () => {
  it.each([
    [Role.APPROVING_OFFICER, 'approvals'],
    [Role.APPROVING_OFFICER, 'queue'], // alias
    [Role.APPROVING_OFFICER, 'requisitions'],
    [Role.IT_ASSET_CUSTODIAN, 'fulfillment'],
    [Role.IT_ASSET_CUSTODIAN, 'custody'],
    [Role.IT_ASSET_CUSTODIAN, 'disposal'],
    [Role.IT_ASSET_CUSTODIAN, 'requisitions'],
    [Role.PROPERTY_CUSTODIAN, 'fulfillment'],
    [Role.PROPERTY_CUSTODIAN, 'custody'],
    [Role.PROPERTY_CUSTODIAN, 'disposal'],
    // The two property roles file requisitions like any other holder.
    [Role.PROPERTY_CUSTODIAN, 'requisitions'],
    [Role.PROPERTY_OFFICER, 'requisitions'],
    // The System Administrator fulfils a custodian's own requisition (the
    // custodian cannot), so the fulfilment screen is theirs too.
    [Role.MASTER_ADMIN, 'fulfillment'],
  ])('%s / %s is live', (role, slug) => {
    expect(isLiveWorkflowPage(role, slug)).toBe(true);
  });
});

describe('isLiveWorkflowPage — the sample-data screens, and pages with their own component, are not', () => {
  it.each([
    [Role.APPROVING_OFFICER, 'approval-history'],
    [Role.APPROVING_OFFICER, 'history'],
    [Role.PROPERTY_CUSTODIAN, 'physical-inventory'],
    [Role.PROPERTY_CUSTODIAN, 'inventory'],
    [Role.IT_ASSET_CUSTODIAN, 'physical-inventory'],
    [Role.PROPERTY_OFFICER, 'corrections'],
    [Role.PROPERTY_OFFICER, 'reconciliation'],
    [Role.PROPERTY_OFFICER, 'disposal'], // live for the custodians, not for the Officer
    [Role.PROPERTY_OFFICER, 'disposal-review'],
    [Role.PROPERTY_OFFICER, 'audit'],
    [Role.PROPERTY_OFFICER, 'audit-history'],
    // Management's Audit Log is the real audit viewer, not a WorkflowPage table.
    [Role.MANAGEMENT_AUDIT_VIEWER, 'audit'],
    [Role.MANAGEMENT_AUDIT_VIEWER, 'audit-log'],
  ])('%s / %s is not live', (role, slug) => {
    expect(isLiveWorkflowPage(role, slug)).toBe(false);
  });

  it('treats an unknown address as not live, for every role', () => {
    for (const role of Object.values(Role)) {
      expect(isLiveWorkflowPage(role, 'no-such-page')).toBe(false);
    }
  });
});
