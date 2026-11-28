import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { roleNavigation } from '@/lib/roles/role-navigation';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';

// The shell is on every screen of every role. Its brand block used to be a generic
// shield icon over an abbreviated "CICC Asset Mgmt", and its header carried a "CICC"
// chip and a refresh button that added nothing: the screens read like a template.

vi.mock('next/navigation', () => ({
  usePathname: () => '/employee/dashboard',
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));
vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ user: { firstName: 'Ana', lastName: 'Reyes' }, logout: () => undefined }),
}));

const role = ProposedUserRole.EMPLOYEE;

const sidebar = (collapsed = false) =>
  renderToStaticMarkup(
    <SidebarNav role={role} items={roleNavigation[role]} collapsed={collapsed} onToggle={() => undefined} />,
  );
const topBar = () => renderToStaticMarkup(<TopBar role={role} onMenuClick={() => undefined} />);

describe('the sidebar brand', () => {
  it('names the system in full, not "Mgmt"', () => {
    const html = sidebar();

    expect(html).toContain('CICC Asset Management');
    expect(html).not.toContain('Mgmt');
  });

  it('shows the CICC logo, not a generic shield icon', () => {
    const html = sidebar();

    expect(html).toMatch(/<img[^>]+alt="CICC logo"/);
    expect(html).toContain('logo.png');
    expect(html).not.toContain('lucide-shield');
  });

  // The collapsed rail is 80px wide: it shows the expand button, not the brand.
  it('drops the brand text when the sidebar is collapsed', () => {
    expect(sidebar(true)).not.toContain('CICC Asset Management');
  });
});

describe('the sidebar footer', () => {
  // "Management & Audit Viewer" was cut to "Management & Audit Vi…" by a truncating line.
  it('lets a long role name wrap instead of cutting it off', () => {
    const html = sidebar();
    const roleLine = /<p class="([^"]*)">Employee<\/p>/.exec(html);

    expect(roleLine).not.toBeNull();
    expect(roleLine![1]).not.toContain('truncate');
  });
});

describe('the top bar', () => {
  it('has no "CICC" chip: the logo and the brand already say it', () => {
    expect(topBar()).not.toContain('CICC');
  });

  it('has no refresh button: the browser already has one', () => {
    const html = topBar();

    expect(html).not.toContain('Refresh page');
    expect(html).not.toContain('lucide-refresh-cw');
  });

  it('keeps the notification bell and the date', () => {
    const html = topBar();

    expect(html).toContain('Open important notifications');
    expect(html).toMatch(/\d{4}/); // the year in the date
  });
});
