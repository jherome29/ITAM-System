import { describe, expect, it } from 'vitest';
import { roleNavigation } from '@/lib/roles/role-navigation';
import { hasUiPermission } from '@/lib/roles/role-permissions';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { mapBackendRoleToProposedRole } from '@/lib/roles/role-mapping';

describe('role-based sidebar navigation', () => {
  it('routes both existing custodian account types to the combined role', () => {
    expect(mapBackendRoleToProposedRole('it_personnel')).toBe(ProposedUserRole.ASSET_CUSTODIAN);
    expect(mapBackendRoleToProposedRole('property_custodian')).toBe(ProposedUserRole.ASSET_CUSTODIAN);
  });
  it('shows only personal workflow pages for employees', () => {
    const labels = roleNavigation[ProposedUserRole.EMPLOYEE].map((item) => item.label);
    expect(labels).toEqual([
      'My Dashboard',
      'Asset Catalogue',
      'My Requisitions',
      'My Assigned Assets',
      'Returns & Incidents',
      'Notifications',
    ]);
  });

  it('combines custodian operations while keeping three inventory pages', () => {
    const items = roleNavigation[ProposedUserRole.ASSET_CUSTODIAN];
    expect(items.filter(item => ['IT Inventory', 'Fixed Asset Inventory', 'Supplies Inventory'].includes(item.label)).map(item => item.href)).toEqual([
      '/asset-custodian/it-inventory', '/asset-custodian/fixed-assets', '/asset-custodian/supplies',
    ]);
    expect(items.map(item => item.label)).toContain('Maintenance & Repair');
    expect(hasUiPermission(ProposedUserRole.ASSET_CUSTODIAN, 'issue_ict_assets')).toBe(true);
    expect(hasUiPermission(ProposedUserRole.ASSET_CUSTODIAN, 'issue_property')).toBe(true);
    expect(Object.values(ProposedUserRole)).toHaveLength(5);
  });

  it('keeps master administrator out of ordinary approval actions', () => {
    const labels = roleNavigation[ProposedUserRole.MASTER_ADMIN].map((item) => item.label).join(' ');
    expect(labels).toContain('Users & Accounts');
    // The governance/platform mock pages (incl. "Security Policies") were cut as
    // out of scope on 2026-09-09 — System Settings is the surviving platform nav.
    expect(labels).toContain('System Settings');
    expect(labels).toContain('Audit Log');
    expect(labels).not.toContain('Approval Queue');
    expect(hasUiPermission(ProposedUserRole.MASTER_ADMIN, 'approve_requisition')).toBe(false);
  });

  it('marks management and audit viewer controls as read-only', () => {
    // Oversight pages are read-only; the one exception is the viewer's own
    // accountability — they hold property too and must be able to return it.
    const nav = roleNavigation[ProposedUserRole.MANAGEMENT_AUDIT_VIEWER];
    expect(nav.filter((item) => !item.readOnly).map((item) => item.href)).toEqual(['/management-audit/assigned-assets']);
    expect(hasUiPermission(ProposedUserRole.MANAGEMENT_AUDIT_VIEWER, 'read_only')).toBe(true);
    expect(hasUiPermission(ProposedUserRole.MANAGEMENT_AUDIT_VIEWER, 'issue_property')).toBe(false);
  });
});

describe('navigation coverage', () => {
  it('has enough nav items for responsive sidebar coverage', () => {
    // Dashboard / Users / Roles / System Settings / Audit / Notifications — the
    // six that survived the 2026-09-09 governance cut.
    expect(roleNavigation[ProposedUserRole.MASTER_ADMIN].length).toBeGreaterThanOrEqual(6);
  });
});
