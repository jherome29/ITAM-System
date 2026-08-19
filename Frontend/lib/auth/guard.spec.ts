import { describe, expect, it } from 'vitest';
import { shouldRedirectToLogin } from './guard';

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
