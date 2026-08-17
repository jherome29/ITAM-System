'use client';

import { usePathname, useRouter } from 'next/navigation';
import { appConfig } from '@/lib/config';
import { ProposedUserRole, proposedRoleLabels, roleHomePaths } from '@/lib/roles/proposed-roles';

export function RoleSwitcher({ currentRole }: Readonly<{ currentRole: ProposedUserRole }>) {
  const router = useRouter();
  const pathname = usePathname();

  if (appConfig.isProduction || !appConfig.enableRolePreview) return null;

  const handleChange = (value: string) => {
    const role = value as ProposedUserRole;
    const currentLastSegment = pathname.split('/').findLast(Boolean);
    const nextBase = roleHomePaths[role];
    if (!currentLastSegment || currentLastSegment === 'dashboard') {
      router.push(nextBase);
      return;
    }
    const nextRoot = nextBase.replace('/dashboard', '');
    router.push(`${nextRoot}/${currentLastSegment}`);
  };

  return (
    <label className="hidden items-center gap-2 text-xs font-semibold text-slate-500 lg:flex">
      <span>Preview role</span>
      <select
        value={currentRole}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-800 shadow-sm"
      >
        {Object.values(ProposedUserRole).map((role) => (
          <option key={role} value={role}>{proposedRoleLabels[role]}</option>
        ))}
      </select>
    </label>
  );
}
