'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

function labelize(segment: string) {
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-blue-700">AIMRS</Link>
      {parts.map((part, index) => {
        const href = `/${parts.slice(0, index + 1).join('/')}`;
        const isLast = index === parts.length - 1;
        return (
          <span key={href} className="flex items-center gap-2">
            <ChevronRight className="h-3.5 w-3.5" />
            {isLast ? (
              <span className="font-semibold text-slate-950">{labelize(part)}</span>
            ) : (
              <Link href={href} className="hover:text-blue-700">{labelize(part)}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

