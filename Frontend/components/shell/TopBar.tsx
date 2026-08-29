'use client';

import { Bell, Building2, CalendarDays, Menu, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { ProposedUserRole } from '@/lib/roles/proposed-roles';
import { roleNavigation } from '@/lib/roles/role-navigation';
import { notificationsApi, type Notification } from '@/lib/api/notifications';

// Turns a backend notification into the "ASSETS - TODAY" caption the dropdown shows.
// Prefer the related record type; fall back to the alert type (e.g. "LOW STOCK").
function captionFor(n: Notification): string {
  const label = (n.relatedRecordType ?? n.alertType).replace(/_/g, ' ').toUpperCase();
  const created = new Date(n.createdAt);
  const now = new Date();
  const sameDay =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();
  const when = sameDay
    ? 'TODAY'
    : created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${label} - ${when}`;
}

export function TopBar({ role, onMenuClick }: Readonly<{ role: ProposedUserRole; onMenuClick: () => void }>) {
  const router = useRouter();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
  const notificationHref =
    roleNavigation[role].find((item) => item.label === 'Notifications')?.href ??
    roleNavigation[role].find((item) => item.label.includes('Audit'))?.href ??
    roleNavigation[role][0].href;

  // Live unread feed for the header bell. Silent on failure — this is a peek,
  // the full page (notificationHref) owns loading/error states.
  const loadNotifications = useCallback(() => {
    notificationsApi
      .list()
      .then((r) => {
        setNotifications(r.data.notifications);
        setUnreadCount(r.data.unreadCount);
      })
      .catch(() => {
        setNotifications([]);
        setUnreadCount(0);
      });
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const importantNotifications = notifications.filter((item) => !item.isRead).slice(0, 3);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-7">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden md:block">
          <Breadcrumbs />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden h-9 items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 text-sm font-bold text-blue-700 sm:flex">
          <Building2 className="h-4 w-4" />
          CICC
        </span>
        <span className="hidden h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-600 sm:flex">
          <CalendarDays className="h-4 w-4" />
          {date}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((value) => {
                const next = !value;
                if (next) loadNotifications();
                return next;
              });
            }}
            className="relative grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
            aria-label="Open important notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-950">Important Notifications</p>
                  <p className="text-xs text-slate-500">Unread items only</p>
                </div>
                <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{unreadCount}</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {importantNotifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">No important notifications.</p>
                ) : (
                  importantNotifications.map((item) => (
                    <Link
                      key={item.id}
                      href={notificationHref}
                      onClick={() => setNotificationsOpen(false)}
                      className="block border-b border-slate-100 px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-2 w-2 flex-none rounded-full bg-red-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.message}</p>
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-blue-700">{captionFor(item)}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
              <Link
                href={notificationHref}
                onClick={() => setNotificationsOpen(false)}
                className="block bg-slate-50 px-4 py-3 text-center text-sm font-bold text-blue-700 hover:bg-blue-50"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
        <button type="button" onClick={() => { setRefreshing(true); router.refresh(); window.setTimeout(() => setRefreshing(false), 600); }} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh page" title="Refresh page">
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}
