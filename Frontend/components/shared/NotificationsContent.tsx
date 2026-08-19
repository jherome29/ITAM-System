'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { notificationsApi, type Notification } from '@/lib/api/notifications';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

function NotifIcon({ type }: Readonly<{ type: string }>) {
  if (type === 'REQUISITION_APPROVED' || type === 'REQUISITION_FULFILLED')
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  if (type === 'REQUISITION_REJECTED')
    return <XCircle className="w-5 h-5 text-red-500" />;
  return <AlertCircle className="w-5 h-5 text-blue-500" />;
}

export function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsApi
      .list()
      .then((r) => setNotifications(r.data.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        action={<button type="button" onClick={markAllRead} className="text-sm text-[#1a4d7a] font-medium hover:underline">Mark all as read</button>}
      />
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          No notifications.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className={`bg-white rounded-lg shadow-sm border p-4 ${n.isRead ? 'border-gray-200' : 'border-blue-300 bg-blue-50'}`}>
              <div className="flex gap-4">
                <div className="shrink-0 mt-0.5"><NotifIcon type={n.alertType} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <p className={`text-sm ${n.isRead ? 'text-gray-700' : 'font-medium text-gray-900'}`}>{n.title}</p>
                    <span className="text-xs text-gray-400 shrink-0">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
