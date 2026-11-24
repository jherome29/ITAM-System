'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { RoleNavItem } from '@/lib/roles/role-navigation';
import { proposedRoleLabels, ProposedUserRole } from '@/lib/roles/proposed-roles';
import { appConfig } from '@/lib/config';
import { useAuth } from '@/lib/auth/use-auth';

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
  const { logout, user } = useAuth();
  const compact = collapsed && !mobile;
  const displayName = user ? `${user.firstName} ${user.lastName}` : proposedRoleLabels[role];
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : proposedRoleLabels[role].slice(0, 2).toUpperCase();

  return (
    <aside
      className={`${
        mobile ? 'h-full' : 'fixed inset-y-0 left-0 z-30 hidden h-screen lg:flex'
      } ${mobile ? 'w-full' : compact ? 'w-20' : 'w-72'} flex-col bg-[#0b2038] text-white transition-all`}
    >
      <div className={`flex h-16 shrink-0 items-center border-b border-white/10 ${compact ? 'justify-center px-2' : 'gap-3 px-4'}`}>
        {!compact && (
          <>
            <Image src="/logo.png" alt="CICC logo" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight">{appConfig.appName}</p>
              <p className="max-w-[9rem] text-sm leading-tight text-blue-200">CICC Asset Management</p>
            </div>
          </>
        )}
        {mobile ? (
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-2 text-blue-100 hover:bg-white/10" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button type="button" onClick={onToggle} className={`${compact ? '' : 'ml-auto'} shrink-0 rounded-md p-2 text-blue-100 hover:bg-white/10`}
            aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!compact}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact ? 'px-2' : 'px-3'}`}>
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const showSection = item.section && (!collapsed || mobile);
          return (
            <div key={item.href}>
              {showSection && (
                <p className={`${index === 0 ? '' : 'pt-5'} px-1 pb-2 text-xs font-bold uppercase tracking-wider text-blue-300`}>
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onClose}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 items-center rounded-md py-2 text-[15px] font-semibold transition ${compact ? 'justify-center px-0' : 'gap-3 px-3'} ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 flex-none" />
                {!compact && <span className="leading-snug">{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className={`flex min-h-12 items-center ${collapsed && !mobile ? 'justify-center' : 'gap-3'}`}>
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-blue-300/30 bg-blue-950 text-[11px] font-bold leading-none text-blue-100">
            {initials}
          </span>
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-5 text-white">{displayName}</p>
              <p className="truncate text-xs leading-4 text-blue-200">{proposedRoleLabels[role]}</p>
            </div>
          )}
          {(!collapsed || mobile) && (
            <button
              type="button"
              onClick={() => logout()}
              className="grid h-8 w-8 flex-none place-items-center rounded-md text-blue-200 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
