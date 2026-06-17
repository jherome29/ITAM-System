'use client';

import { LogOut } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/use-auth';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-[#1a4d7a] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="CICC Logo" width={44} height={44} className="object-contain" />
            <div>
              <span className="text-white font-semibold text-base leading-tight block">
                Asset Management System
              </span>
              <span className="text-blue-200 text-xs">CICC — AIMRS</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-blue-100 text-sm hidden sm:block">
                {user.firstName} {user.lastName}
              </span>
            )}
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white hover:bg-[#143d61] rounded-md transition-colors duration-150"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
