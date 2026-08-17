'use client';

import Link from 'next/link';
import { LogOut, Shield, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { RoleNavItem } from '@/lib/roles/role-navigation';
import { proposedRoleLabels, ProposedUserRole } from '@/lib/roles/proposed-roles';
import { appConfig } from '@/lib/config';

export function SidebarNav({
  role,
  items,
  collapsed,
  mobile,
  onToggle,
  onClose,
}: Readonly<{
  role: ProposedUserRole;
  items: RoleNavItem[];
  collapsed: boolean;
  mobile?: boolean;
  onToggle: () => void;
  onClose?: () => void;
}>) {
  const pathname = usePathname();
  const persona = {
    [ProposedUserRole.EMPLOYEE]: { initials: 'AR', name: 'Ana Reyes' },
    [ProposedUserRole.APPROVING_OFFICER]: { initials: 'MS', name: 'Mila Santos' },
    [ProposedUserRole.IT_ASSET_CUSTODIAN]: { initials: 'PC', name: 'Paolo Cruz' },
    [ProposedUserRole.PROPERTY_CUSTODIAN]: { initials: 'LG', name: 'Leah Garcia' },
    [ProposedUserRole.PROPERTY_OFFICER]: { initials: 'MD', name: 'Marisol Dela Cruz' },
    [ProposedUserRole.MASTER_ADMIN]: { initials: 'RT', name: 'Dir. Ricardo Torres' },
    [ProposedUserRole.MANAGEMENT_AUDIT_VIEWER]: { initials: 'ED', name: 'Elena Dizon' },
  }[role];

  return (
    <aside
      className={`${
        mobile ? 'h-full' : 'fixed inset-y-0 left-0 z-30 hidden h-screen lg:flex'
      } ${collapsed && !mobile ? 'w-20' : 'w-64'} flex-col bg-[#0b2038] text-white transition-all`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-blue-600">
          <Shield className="h-5 w-5" />
        </span>
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{appConfig.appName}</p>
            <p className="truncate text-xs text-blue-200">CICC Asset Mgmt</p>
          </div>
        )}
        {mobile ? (
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-2 text-blue-100 hover:bg-white/10" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button type="button" onClick={onToggle} className="ml-auto rounded-md p-2 text-blue-100 hover:bg-white/10" aria-label="Collapse navigation">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const showSection = item.section && (!collapsed || mobile);
          return (
            <div key={item.href}>
              {showSection && (
                <p className={`${index === 0 ? '' : 'pt-5'} px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-blue-300`}>
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onClose}
                title={item.label}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 flex-none" />
                {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className={`flex min-h-12 items-center ${collapsed && !mobile ? 'justify-center' : 'gap-3'}`}>
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-blue-300/30 bg-blue-950 text-[11px] font-bold leading-none text-blue-100">
            {persona.initials}
          </span>
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-5 text-white">{persona.name}</p>
              <p className="truncate text-xs leading-4 text-blue-200">{proposedRoleLabels[role]}</p>
            </div>
          )}
          {(!collapsed || mobile) && <Link href="/login" className="grid h-8 w-8 flex-none place-items-center rounded-md text-blue-200 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></Link>}
        </div>
      </div>
    </aside>
  );
}
