import type { AuthUser } from '@/lib/api/auth';
import { ProposedUserRole, roleHomePaths } from '@/lib/roles/proposed-roles';
import { mapBackendRoleToProposedRole } from '@/lib/roles/role-mapping';

/**
 * True when the auth session has finished loading and no user is present —
 * the signal AppShell uses to redirect to /login. Kept as a pure function,
 * separate from the component, so it's testable without a DOM environment
 * (this repo's Vitest config runs in `node`, not `jsdom`).
 */
export function shouldRedirectToLogin(user: AuthUser | null, isLoading: boolean): boolean {
  return !isLoading && !user;
}

/**
 * Where to send a signed-in user who opened a workspace that is not theirs
 * (e.g. an employee typing /master-admin/dashboard), or null when they belong
 * on it, are still loading, or are signed out (shouldRedirectToLogin owns that).
 *
 * UX only — the API refuses every data call for the wrong role regardless —
 * but without it the other role's whole shell (sidebar, action buttons, a role
 * label under the user's name) renders for anyone who knows the URL.
 */
export function wrongWorkspaceRedirect(
  user: AuthUser | null,
  isLoading: boolean,
  workspaceRole: ProposedUserRole,
): string | null {
  if (isLoading || !user) return null;
  const ownRole = mapBackendRoleToProposedRole(user.role);
  return ownRole === workspaceRole ? null : roleHomePaths[ownRole];
}
