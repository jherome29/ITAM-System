import { notificationMockRows } from '@/lib/mock/notifications.mock';

// Frontend-only prototype.
// Backend authorization and persistence will be implemented in a later phase.
export const mockNotificationsService = {
  list: () => notificationMockRows,
  unread: () => notificationMockRows.filter((notification) => notification.unread),
  byCategory: (category: string) =>
    category === 'All'
      ? notificationMockRows
      : notificationMockRows.filter((notification) => notification.category === category),
};

