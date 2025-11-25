import api from './api';

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  read: boolean;
  feedbackId?: string | null;
  createdAt: string;
};

export async function listAdminNotifications(): Promise<AdminNotification[]> {
  const { data } = await api.get<AdminNotification[]>('/admin-notifications');
  return data;
}

export async function markAdminNotificationRead(id: string): Promise<void> {
  await api.patch(`/admin-notifications/${id}/read`);
}

export async function markAllAdminNotificationsRead(): Promise<void> {
  await api.post('/admin-notifications/read-all');
}

export async function deleteAdminNotification(id: string): Promise<void> {
  await api.delete(`/admin-notifications/${id}`);
}
