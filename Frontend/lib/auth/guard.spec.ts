import { describe, expect, it } from 'vitest';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { shouldRedirectToLogin, wrongWorkspaceRedirect } from './guard';

const asUser = (role: string) => ({ id: 'u1', role }) as never;

describe('shouldRedirectToLogin', () => {
  it('does not redirect while the session is still loading', () => {
    expect(shouldRedirectToLogin(null, true)).toBe(false);
  });

  it('redirects once loading has finished and there is no user', () => {
    expect(shouldRedirectToLogin(null, false)).toBe(true);
  });

  it('does not redirect once loading has finished and a user is present', () => {
    expect(shouldRedirectToLogin({ id: 'u1' } as never, false)).toBe(false);
  });
});

// A shell must belong to the signed-in user's role. The backend refuses every
// data call for the wrong role, but the page chrome (admin sidebar, "Add asset"
// button, a "Master Administrator" label under an employee's name) used to
// render for anyone who typed another role's URL.
describe('wrongWorkspaceRedirect', () => {
  const ADMIN_SHELL = ProposedUserRole.MASTER_ADMIN;

  it('does nothing while the session is still loading', () => {
    expect(wrongWorkspaceRedirect(asUser('employee'), true, ADMIN_SHELL)).toBeNull();
  });

  it('leaves the signed-out case to shouldRedirectToLogin', () => {
    expect(wrongWorkspaceRedirect(null, false, ADMIN_SHELL)).toBeNull();
  });

  it('lets a user stay in their own workspace', () => {
    expect(wrongWorkspaceRedirect(asUser('system_admin'), false, ADMIN_SHELL)).toBeNull();
    expect(
      wrongWorkspaceRedirect(asUser('it_personnel'), false, ProposedUserRole.IT_ASSET_CUSTODIAN),
    ).toBeNull();
  });

  it.each([
    ['employee', ProposedUserRole.MASTER_ADMIN, '/employee/dashboard'],
    ['employee', ProposedUserRole.IT_ASSET_CUSTODIAN, '/employee/dashboard'],
    ['supervisor', ProposedUserRole.IT_ASSET_CUSTODIAN, '/approving-officer/dashboard'],
    ['system_admin', ProposedUserRole.EMPLOYEE, '/master-admin/dashboard'],
    ['property_custodian', ProposedUserRole.MASTER_ADMIN, '/property-custodian/dashboard'],
    ['management', ProposedUserRole.MASTER_ADMIN, '/management-audit/dashboard'],
  ])('sends a %s who opened the %s workspace to %s', (role, shell, home) => {
    expect(wrongWorkspaceRedirect(asUser(role), false, shell)).toBe(home);
  });

  it('treats an unrecognised backend role as an employee', () => {
    expect(wrongWorkspaceRedirect(asUser('visitor'), false, ADMIN_SHELL)).toBe('/employee/dashboard');
  });

  // An account that somehow kept the retired role is refused by every backend
  // guard, so the UI must not give it a privileged workspace either.
  it('treats the retired property_officer backend role as an employee, not a custodian', () => {
    expect(wrongWorkspaceRedirect(asUser('property_officer'), false, ADMIN_SHELL)).toBe('/employee/dashboard');
  });
});
