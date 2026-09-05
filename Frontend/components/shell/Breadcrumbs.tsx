'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

// Path segments that should render fully uppercased rather than title-cased
// (e.g. "it-asset-custodian" -> "IT Asset Custodian", "qr-scan" -> "QR Scan").
const ACRONYMS = new Set(['it', 'qr', 'ict', 'sla', 'id', 'par', 'ics', 'ris', 'coa', 'kpi']);

function labelize(segment: string) {
  return segment
    .split('-')
    .map((part) =>
      ACRONYMS.has(part.toLowerCase())
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ');
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);

  // The first segment is the role area (e.g. "Master Admin") and stays a link to
  // the role home. There is deliberately no crumb for "/" — it only ever bounces
  // through /login back to the role home (see proxy.ts), which reads as a bug.
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
      {parts.map((part, index) => {
        const href = `/${parts.slice(0, index + 1).join('/')}`;
        const isLast = index === parts.length - 1;
        return (
          <span key={href} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
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

