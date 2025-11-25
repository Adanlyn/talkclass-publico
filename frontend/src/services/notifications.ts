// src/services/notifications.ts
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { createElement } from 'react';

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;  // ISO
  read?: boolean;
  severity?: 'info' | 'warning' | 'error';
};

// ---------- helpers para extrair mensagem de erro ----------
function extractMsg(err: unknown): string {
  // AxiosError?
  const anyErr = err as any;
  const data = anyErr?.response?.data;

  if (typeof data === 'string' && data.trim()) return data;              // backend retornou string
  if (data?.message && typeof data.message === 'string') return data.message; // backend retornou { message }
  if (Array.isArray(data) && data.length) {
    const first = data[0];
    if (typeof first === 'string') return first;
    if (first?.description) return String(first.description);
    if (first?.error) return String(first.error);
  }

  // fallback
  if (anyErr?.message) return String(anyErr.message);
  return 'Ocorreu um erro. Tente novamente.';
}
// -----------------------------------------------------------

export const notifySuccess = (msg: string) =>
  notifications.show({
    message: msg,
    color: 'green',
    icon: createElement(IconCheck),
    autoClose: 4000,
  });

// agora aceita qualquer coisa (string, Error, AxiosError, etc.)
export const notifyError = (err: unknown) =>
  notifications.show({
    message: extractMsg(err),
    color: 'red',
    icon: createElement(IconX),
    autoClose: 6000,
  });

const KEY = 'tc.notifications';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as NotificationItem[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveNotifications(list: NotificationItem[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addNotification(partial: Omit<NotificationItem, 'id' | 'createdAt'>) {
  const list = loadNotifications();
  const item: NotificationItem = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...partial,
  };
  const next = [item, ...list].slice(0, 200);
  saveNotifications(next);
  return item;
}

export function removeNotification(id: string) {
  const next = loadNotifications().filter((n) => n.id !== id);
  saveNotifications(next);
}

export function clearAllNotifications() {
  saveNotifications([]);
}

export function markAllRead() {
  const next = loadNotifications().map((n) => ({ ...n, read: true }));
  saveNotifications(next);
}

export function unreadCount() {
  return loadNotifications().filter((n) => !n.read).length;
}

// Preenche exemplos na 1ª carga (útil no TCC)
export function seedNotificationsIfEmpty() {
  if (loadNotifications().length) return;
  const now = Date.now();
  const base: NotificationItem[] = [
    {
      id: uid(),
      title: 'Pico de negativos em “Wi-Fi”',
      message: 'Aumento de 35% de feedbacks negativos sobre conexão no Bloco B.',
      createdAt: new Date(now - 1000 * 60 * 12).toISOString(),
      severity: 'warning',
    },
    {
      id: uid(),
      title: 'Biblioteca em alta',
      message: 'Métrica de satisfação da Biblioteca subiu para 4,4 (+0,3).',
      createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
      severity: 'info',
      read: true,
    },
    {
      id: uid(),
      title: 'Alerta de limpeza',
      message: 'Queda na avaliação de limpeza dos banheiros do 2º andar.',
      createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
      severity: 'error',
    },
  ];
  saveNotifications(base);
}
