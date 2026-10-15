import { describe, expect, it } from 'vitest';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';

// Every other role's router answers an address with no screen behind it with a 404.
// The Master Admin's used to show the dashboard instead, so /master-admin/corrections
// looked like a real page that just happened to be the overview.
function digestOf(slug: string): string {
  try {
    AdminWorkspace({ slug });
  } catch (error) {
    return String((error as { digest?: string }).digest ?? '');
  }
  return '';
}

describe('AdminWorkspace routing', () => {
  it('answers an address with no screen with not-found', () => {
    expect(digestOf('corrections')).toContain('404');
    expect(digestOf('no-such-page')).toContain('404');
  });

  it.each(['dashboard', 'users', 'roles', 'configuration', 'audit', 'returns-incidents', 'repairs', 'assigned-assets', 'notifications'])(
    'still serves the real "%s" screen',
    (slug) => {
      expect(digestOf(slug)).toBe('');
    },
  );
});
