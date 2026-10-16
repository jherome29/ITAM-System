import { describe, expect, it } from 'vitest';
import { ProposedUserRole, proposedRoleLabels, workspaceLabels } from './proposed-roles';

// Management's official title is "Management & Audit Viewer". Above a page title it read
// "Management" on six pages and the full title on two, and in the sidebar footer it was
// cut off. The name over a page title is one short label per workspace.

describe('workspaceLabels', () => {
  it('names the Management workspace "Management", the short form its pages use', () => {
    expect(workspaceLabels[ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]).toBe('Management');
  });

  it('keeps every other workspace named after its role', () => {
    for (const role of Object.values(ProposedUserRole)) {
      if (role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER) continue;
      expect(workspaceLabels[role]).toBe(proposedRoleLabels[role]);
    }
  });

  it('still shows the official title as the role itself', () => {
    expect(proposedRoleLabels[ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]).toBe('Management & Audit Viewer');
  });
});
