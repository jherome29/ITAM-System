import { describe, expect, it } from 'vitest';
import { ProposedUserRole } from './proposed-roles';
import { roleNavigation } from './role-navigation';

const hrefsOf = (role: ProposedUserRole) => roleNavigation[role].map((item) => item.href);

// Menu entries that opened screens with no backend behind them: hard-coded
// sample rows and buttons that saved nothing. They are removed until the
// feature (and its business rules) exist.
describe('Property Custodian menu', () => {
  it('does not offer screens that have no backend', () => {
    const hrefs = hrefsOf(ProposedUserRole.PROPERTY_CUSTODIAN);
    expect(hrefs).not.toContain('/property-custodian/corrections');
    expect(hrefs).not.toContain('/property-custodian/reconciliation');
    expect(hrefs).not.toContain('/property-custodian/audit');
  });

  // The Property Officer was merged into the custodian: its two screens that read
  // real records (replacement validation, disposal review) moved here.
  it('has the two review screens the Property Officer used to have', () => {
    expect(hrefsOf(ProposedUserRole.PROPERTY_CUSTODIAN)).toEqual(
      expect.arrayContaining([
        '/property-custodian/replacements',
        '/property-custodian/disposal-review',
        '/property-custodian/disposal', // the recommend-for-disposal screen stays
        '/property-custodian/reports',
        '/property-custodian/assigned-assets',
        '/property-custodian/notifications',
      ]),
    );
  });
});

// The Property Officer was a read-only subset of the Property Custodian, so it was
// merged into it. The role has no workspace, menu or label left.
describe('the retired Property Officer role', () => {
  it('is no longer a role of the frontend', () => {
    expect(Object.values(ProposedUserRole)).not.toContain('property_officer');
    expect(Object.keys(roleNavigation)).not.toContain('property_officer');
  });

  it('has no menu entry in any workspace', () => {
    const hrefs = Object.values(roleNavigation).flatMap((items) => items.map((i) => i.href));
    expect(hrefs.filter((h) => h.startsWith('/property-officer'))).toEqual([]);
  });
});

// Holding property does not make someone a requester, but the Property Custodian
// files requisitions like the employee they are. Management (read-only oversight)
// and the System Administrator do not.
describe('who can file a requisition, by menu', () => {
  it('gives the Property Custodian My Requisitions', () => {
    expect(hrefsOf(ProposedUserRole.PROPERTY_CUSTODIAN)).toContain('/property-custodian/requisitions');
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
