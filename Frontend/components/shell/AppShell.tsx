'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { roleNavigation } from '@/lib/roles/role-navigation';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { useAuth } from '@/lib/auth/use-auth';
import { shouldRedirectToLogin, wrongWorkspaceRedirect } from '@/lib/auth/guard';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';

export function AppShell({ role, children }: Readonly<{ role: ProposedUserRole; children: ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = roleNavigation[role];

  // Matches the guard DashboardLayout has always used on /supervisor,
  // /it-personnel, /admin, /management — restores it here since the
  // frontend redesign introduced AppShell (used by /employee and all 6
  // new role-prototype routes) without one. Backend guards independently
  // enforce everything regardless; this is UX-only defense-in-depth
  // (SECURITY.md §10.3), not the real security boundary.
  //
  // Two checks: signed out → /login; signed in but on another role's workspace
  // (an employee typing /master-admin/...) → their own home, rendering nothing
  // meanwhile so the foreign sidebar and buttons never flash.
  const { isLoading, user } = useAuth();
  const router = useRouter();
  const ownHome = wrongWorkspaceRedirect(user, isLoading, role);

  useEffect(() => {
    if (shouldRedirectToLogin(user, isLoading)) {
      router.replace('/login');
    } else if (ownHome) {
      router.replace(ownHome);
    }
  }, [isLoading, user, ownHome, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!user || ownHome) return null;

  return (
    <div className="min-h-screen bg-canvas text-slate-950">
      <SidebarNav role={role} items={items} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} aria-label="Close navigation backdrop" />
          <div className="relative h-full w-72">
            <SidebarNav
              role={role}
              items={items}
              collapsed={false}
              mobile
              onToggle={() => undefined}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
      <div className={`${collapsed ? 'lg:pl-20' : 'lg:pl-72'} min-w-0 transition-all`}>
        <TopBar role={role} onMenuClick={() => setMobileOpen(true)} />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 overflow-x-hidden p-4 md:p-7"><div className="mx-auto w-full max-w-[1480px]">{children}</div></main>
        <footer className="border-t border-slate-200 bg-white px-5 py-2 text-xs text-slate-500">
          AIMRS v1.0.0 - Cybercrime Investigation and Coordinating Center - ITIL 4 Asset Management
        </footer>
      </div>
    </div>
  );
}
