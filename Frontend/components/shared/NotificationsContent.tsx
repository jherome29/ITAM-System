'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { notificationsApi, type Notification } from '@/lib/api/notifications';
import { notificationTarget, workspaceBasePath } from '@/lib/notifications/notification-target';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { formatDate } from '@/lib/dates';
import { SecondaryButton } from '@/components/admin/AdminUi';
import { surfaceClass } from '@/components/ui/controls';
import { useAuth } from '@/lib/auth/use-auth';
import { workspaceLabels } from '@/lib/roles/proposed-roles';
import { mapBackendRoleToProposedRole } from '@/lib/roles/role-mapping';
import { Notice } from '@/components/ui/Notice';

function NotifIcon({ type }: Readonly<{ type: string }>) {
  if (type === 'requisition_approved' || type === 'requisition_fulfilled')
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  if (type === 'requisition_rejected')
    return <XCircle className="h-5 w-5 text-red-500" />;
  if (type === 'sla_breach' || type === 'low_stock' || type === 'overdue_return' || type === 'alternate_approver' || type === 'asset_request')
    return <AlertCircle className="h-5 w-5 text-amber-500" />;
  return <AlertCircle className="h-5 w-5 text-blue-500" />;
}

export function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const basePath = workspaceBasePath(usePathname() ?? '');

  useEffect(() => {
    notificationsApi
      .list()
      .then((r) => setNotifications(r.data.notifications))
      .catch(() => setError('Could not load notifications. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={workspaceLabels[mapBackendRoleToProposedRole(user?.role)]}
        title="Notifications"
        detail="Alerts that need your attention, newest first."
        action={<SecondaryButton onClick={markAllRead}>Mark all as read</SecondaryButton>}
      />
      {error && (
        <Notice tone="red">{error}</Notice>
      )}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : notifications.length === 0 ? (
        <div className={`${surfaceClass} px-6 py-12 text-center text-sm text-slate-600`}>
          <Bell className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          No notifications.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const target = notificationTarget(basePath, n);
            const body = (
              <div className="flex gap-4">
                <div className="mt-0.5 shrink-0"><NotifIcon type={n.alertType} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <p className={`text-sm ${n.isRead ? 'text-slate-700' : 'font-semibold text-slate-950'}`}>{n.title}</p>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(n.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                </div>
                {target && <ChevronRight className="h-5 w-5 shrink-0 self-center text-slate-500" />}
              </div>
            );
            const cardClass = `block rounded-lg border p-4 shadow-sm ${n.isRead ? 'border-slate-200 bg-white' : 'border-blue-300 bg-blue-50'}`;
            return target ? (
              <Link
                key={n.id}
                href={target}
                onClick={() => { if (!n.isRead) notificationsApi.markRead(n.id).catch(() => {}); }}
                className={`${cardClass} hover:border-blue-400`}
              >
                {body}
              </Link>
            ) : (
              <div key={n.id} className={cardClass}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
