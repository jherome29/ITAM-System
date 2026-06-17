'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface NavLink {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  links: NavLink[];
}

export function Sidebar({ links }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-3">
        <nav className="space-y-0.5">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.path || pathname.startsWith(link.path + '/');
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-[#1a4d7a] font-medium border-l-2 border-[#1a4d7a] pl-[10px]'
                    : 'text-gray-600 hover:bg-blue-50 hover:text-[#1a4d7a]'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
