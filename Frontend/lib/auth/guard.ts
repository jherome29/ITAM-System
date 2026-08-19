import type { AuthUser } from '@/lib/api/auth';

/**
 * True when the auth session has finished loading and no user is present —
 * the signal AppShell uses to redirect to /login. Kept as a pure function,
 * separate from the component, so it's testable without a DOM environment
 * (this repo's Vitest config runs in `node`, not `jsdom`).
 */
export function shouldRedirectToLogin(user: AuthUser | null, isLoading: boolean): boolean {
  return !isLoading && !user;
}
