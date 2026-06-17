import client, { type ApiResponse } from './client';

export interface Notification {
  id: string;
  recipientId: string;
  alertType: string;
  title: string;
  message: string;
  relatedRecordId: string | null;
  relatedRecordType: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationsApi = {
  list: () =>
    client.get<ApiResponse<NotificationsResponse>>('/v1/notifications').then((r) => r.data),

  markRead: (id: string) =>
    client.patch<ApiResponse<Notification>>(`/v1/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    client.patch<ApiResponse<null>>('/v1/notifications/read-all').then((r) => r.data),
};
