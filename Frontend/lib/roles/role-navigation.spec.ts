import { describe, expect, it } from 'vitest';
import { ProposedUserRole } from './proposed-roles';
import { roleNavigation } from './role-navigation';

const hrefsOf = (role: ProposedUserRole) => roleNavigation[role].map((item) => item.href);

// Menu entries that opened screens with no backend behind them: hard-coded
// sample rows and buttons that saved nothing. They are removed until the
// feature (and its business rules) exist.
describe('Property Officer menu', () => {
  it('does not offer screens that have no backend', () => {
    const hrefs = hrefsOf(ProposedUserRole.PROPERTY_OFFICER);
    expect(hrefs).not.toContain('/property-officer/corrections');
    expect(hrefs).not.toContain('/property-officer/reconciliation');
    expect(hrefs).not.toContain('/property-officer/audit');
  });

  it('keeps every screen that reads real records', () => {
    expect(hrefsOf(ProposedUserRole.PROPERTY_OFFICER)).toEqual(
      expect.arrayContaining([
        '/property-officer/dashboard',
        '/property-officer/assets',
        '/property-officer/replacements',
        '/property-officer/disposal', // Disposal Review — now the real list of flagged assets
        '/property-officer/reports',
        '/property-officer/assigned-assets',
        '/property-officer/notifications',
      ]),
    );
  });
});

// Holding property does not make someone a requester, but the Property Custodian
// and Property Officer file requisitions like the employees they are. Management
// (read-only oversight) and the System Administrator do not.
describe('who can file a requisition, by menu', () => {
  it('gives the two property roles My Requisitions', () => {
    expect(hrefsOf(ProposedUserRole.PROPERTY_CUSTODIAN)).toContain('/property-custodian/requisitions');
    expect(hrefsOf(ProposedUserRole.PROPERTY_OFFICER)).toContain('/property-officer/requisitions');
  });

  it('keeps Management and the Master Admin from filing', () => {
    expect(hrefsOf(ProposedUserRole.MANAGEMENT_AUDIT_VIEWER)).not.toContain('/management-audit/requisitions');
    expect(hrefsOf(ProposedUserRole.MASTER_ADMIN)).not.toContain('/master-admin/requisitions');
  });

  it('gives the Master Admin the fallback fulfilment screen', () => {
    expect(hrefsOf(ProposedUserRole.MASTER_ADMIN)).toContain('/master-admin/fulfillment');
  });
});

describe('screens that used to show sample data and are now real', () => {
  it('stay in the menu of the roles that have them', () => {
    expect(hrefsOf(ProposedUserRole.APPROVING_OFFICER)).toContain('/approving-officer/approval-history');
    expect(hrefsOf(ProposedUserRole.PROPERTY_CUSTODIAN)).toContain('/property-custodian/physical-inventory');
    expect(hrefsOf(ProposedUserRole.IT_ASSET_CUSTODIAN)).toContain('/it-asset-custodian/physical-inventory');
  });
});
