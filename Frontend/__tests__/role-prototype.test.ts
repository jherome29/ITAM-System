import { describe, expect, it } from 'vitest';
import { appConfig } from '@/lib/config';
import { mapBackendRoleToProposedRole } from '@/lib/roles/role-mapping';
import { roleNavigation } from '@/lib/roles/role-navigation';
import { hasUiPermission } from '@/lib/roles/role-permissions';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { getDashboardMockData } from '@/lib/mock/dashboard.mock';
import { mockAssetsService } from '@/lib/services/mock-assets.service';
import { mockApprovalsService } from '@/lib/services/mock-approvals.service';

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
    expect(Object.values(ProposedUserRole)).toHaveLength(6);
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
    expect(roleNavigation[ProposedUserRole.MANAGEMENT_AUDIT_VIEWER].every((item) => item.readOnly)).toBe(true);
    expect(hasUiPermission(ProposedUserRole.MANAGEMENT_AUDIT_VIEWER, 'read_only')).toBe(true);
    expect(hasUiPermission(ProposedUserRole.MANAGEMENT_AUDIT_VIEWER, 'issue_property')).toBe(false);
  });
});

describe('prototype states and config', () => {
  it('uses mock data by default for this phase', () => {
    expect(appConfig.useMockData).toBe(true);
  });

  it('has enough nav items for responsive sidebar coverage', () => {
    // Dashboard / Users / Roles / System Settings / Audit / Notifications — the
    // six that survived the 2026-09-09 governance cut.
    expect(roleNavigation[ProposedUserRole.MASTER_ADMIN].length).toBeGreaterThanOrEqual(6);
  });

  it('has role preview enabled in mock development configuration', () => {
    expect(appConfig.enableRolePreview).toBe(true);
  });
});

describe('employee dashboard scope', () => {
  it('does not expose agency-wide value or disposal KPIs to employee dashboard', () => {
    const data = getDashboardMockData(ProposedUserRole.EMPLOYEE);
    const labels = data.kpis.map((item) => item.label).join(' ');
    const subtitles = data.kpis.map((item) => `${item.detail} ${item.trend}`).join(' ');
    expect(labels).toContain('Assigned Assets');
    expect(labels).toContain('Unread Notifications');
    expect(labels).not.toContain('Total Assets');
    expect(labels).not.toContain('For Disposal');
    expect(subtitles).not.toContain('aggregate value');
  });
});

describe('mock services', () => {
  it('keeps ICT and property assets separated for custodians', () => {
    expect(mockAssetsService.listIct().every((asset) => asset.scope === 'ICT')).toBe(true);
    expect(mockAssetsService.listProperty().every((asset) => asset.scope !== 'ICT')).toBe(true);
  });

  it('prevents self requests from appearing in the approval queue service', () => {
    const queue = mockApprovalsService.queueForApprover('Mila Santos', 'EMP-003');
    expect(queue.every((request) => request.requesterId !== 'EMP-003')).toBe(true);
  });
});
