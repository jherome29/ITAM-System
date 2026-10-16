'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, ClipboardList } from 'lucide-react';
import { requisitionsApi } from '@/lib/api/requisitions';
import { notificationsApi } from '@/lib/api/notifications';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/auth/use-auth';
import { buildAvailabilityPayload } from '@/lib/users/availability';
import { PrimaryButton } from '@/components/admin/AdminUi';
import { surfaceClass } from '@/components/ui/controls';
import { DateField } from '@/components/ui/DateField';
import { Field } from '@/components/ui/Field';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  DashboardError,
  KpiTile,
  NotificationsFooter,
  RequisitionListSection,
  RoleDashboardHeader,
  useRoleDashboardData,
} from '@/components/dashboard/RoleDashboardShell';

// Self-service away toggle for an approving officer. When marked unavailable,
// the SLA-breach reassignment (backend) routes new approvals to their alternate.
// Reads the current state from the authenticated profile.
function MyAvailabilityCard() {
  const { user } = useAuth();
  const [unavailable, setUnavailable] = useState<boolean>(Boolean(user?.unavailable));
  const [until, setUntil] = useState<string>(user?.unavailableUntil ? String(user.unavailableUntil).slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // On a hard reload / direct nav this card can mount before useAuth() has the
  // profile (its loading is independent of the dashboard's). The useState
  // initializers above would then latch stale defaults (available / no date),
  // and a Save would PATCH the officer back to available. Re-seed once the
  // profile resolves. Depend on the primitive fields so context re-renders that
  // don't change them don't clobber in-progress edits.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deriving local form state from the auth profile once it loads; deps are the primitive fields being synced
    setUnavailable(Boolean(user?.unavailable));
    setUntil(user?.unavailableUntil ? String(user.unavailableUntil).slice(0, 10) : '');
  }, [user?.unavailable, user?.unavailableUntil]);

  async function save() {
    setSaving(true); setNote(null);
    try {
      await usersApi.setMyAvailability(buildAvailabilityPayload({ unavailable, until }));
      setNote(unavailable ? 'Marked unavailable — new requisitions route to your alternate.' : 'Marked available.');
    } catch {
      setNote('Could not update availability.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${surfaceClass} space-y-4 p-4`}>
      <h2 className="text-base font-bold text-slate-950">My availability</h2>
      <label className="flex items-center gap-3 text-sm text-slate-800">
        <input type="checkbox" className="h-5 w-5 accent-blue-700" checked={unavailable} onChange={(e) => setUnavailable(e.target.checked)} />
        <span>I&apos;m unavailable — route my approvals to my alternate</span>
      </label>
      <div className="max-w-xs">
        <Field label="Until (optional)">
          <DateField value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save availability'}</PrimaryButton>
        {note && <p className="text-sm text-slate-600" role="status">{note}</p>}
      </div>
    </section>
  );
}

export function ApprovingOfficerDashboard() {
  const { data, loading, error } = useRoleDashboardData(async () => {
    const [pendingRes, statsRes, notifRes] = await Promise.all([
      requisitionsApi.list(1, 15, 'pending_supervisor'),
      requisitionsApi.stats(),
      notificationsApi.list(),
    ]);
    return {
      pendingApprovals: pendingRes.data.data,
      pendingTotal: pendingRes.data.total,
      stats: statsRes.data,
      unreadCount: notifRes.data.unreadCount,
    };
  });

  if (loading) {
    return <LoadingSkeleton rows={8} />;
  }

  const pendingApprovals = data?.pendingApprovals ?? [];
  const pendingTotal = data?.pendingTotal ?? 0;
  const stats = data?.stats ?? null;
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5">
      <RoleDashboardHeader eyebrow="Approving Officer" />
      <DashboardError message={error} />

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile icon={ClipboardCheck} tone="amber" label="Pending my approval" value={pendingTotal} href="/approving-officer/approvals" />
        <KpiTile icon={ClipboardList} tone="blue" label="My own requisitions" value={stats?.total ?? 0} href="/approving-officer/requisitions" />
      </div>

      <MyAvailabilityCard />

      <RequisitionListSection
        title="Awaiting My Approval"
        items={pendingApprovals}
        href="/approving-officer/approvals"
        emptyText="Nothing awaiting your approval right now."
      />

      <NotificationsFooter count={unreadCount} href="/approving-officer/notifications" />
    </div>
  );
}
