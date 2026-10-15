import { describe, expect, it } from 'vitest';
import { roleNavigation } from '@/lib/roles/role-navigation';
import { hasUiPermission } from '@/lib/roles/role-permissions';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';

describe('role-based sidebar navigation', () => {
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

  it('keeps ICT asset custodian navigation ICT-specific', () => {
    const labels = roleNavigation[ProposedUserRole.IT_ASSET_CUSTODIAN].map((item) => item.label).join(' ');
    const hrefs = roleNavigation[ProposedUserRole.IT_ASSET_CUSTODIAN].map((item) => item.href);
    expect(labels).toContain('ICT Asset Registry');
    expect(labels).toContain('ICT Reports & Forms');
    expect(labels).not.toContain('Fixed Asset Registry');
    expect(labels).not.toContain('Supply Inventory');
    expect(labels).not.toContain('Register New Asset');
    expect(hrefs).toContain('/it-asset-custodian/physical-inventory');
  });

  it('keeps property custodian navigation away from ICT functions', () => {
    const labels = roleNavigation[ProposedUserRole.PROPERTY_CUSTODIAN].map((item) => item.label).join(' ');
    expect(labels).toContain('Fixed Asset Registry');
    expect(labels).toContain('Supply Inventory');
    expect(labels).not.toContain('ICT Asset Registry');
    expect(labels).not.toContain('ICT Reports & Forms');
    expect(labels).not.toContain('Register New Asset');
    expect(roleNavigation[ProposedUserRole.PROPERTY_CUSTODIAN].map((item) => item.href)).toContain('/property-custodian/physical-inventory');
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
