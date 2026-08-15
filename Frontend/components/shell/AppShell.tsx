'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { roleNavigation } from '@/lib/roles/role-navigation';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { useAuth } from '@/lib/auth/use-auth';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';

export function AppShell({ role, children }: { role: ProposedUserRole; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = roleNavigation[role];

  // Matches the guard DashboardLayout has always used on /supervisor,
  // /it-personnel, /admin, /management — restores it here since the
  // frontend redesign introduced AppShell (used by /employee and all 6
  // new role-prototype routes) without one. Backend guards independently
  // enforce everything regardless; this is UX-only defense-in-depth
  // (SECURITY.md §10.3), not the real security boundary.
  const { isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
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
      <div className={`${collapsed ? 'lg:pl-20' : 'lg:pl-64'} min-w-0 transition-all`}>
        <TopBar role={role} onMenuClick={() => setMobileOpen(true)} />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 overflow-x-hidden p-4 md:p-7">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-5 py-2 text-[11px] text-slate-500">
          AIMRS v1.0.0 - Cybercrime Investigation and Coordinating Center - ITIL 4 Asset Management
        </footer>
      </div>
    </div>
  );
}
