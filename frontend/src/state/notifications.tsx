import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { notifyError } from '../services/notifications';
import { isLoggedIn } from '../utils/auth';
import {
  deleteAdminNotification,
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  type AdminNotification,
} from '../services/adminNotifications';

/** Tipo usado no front com rótulos calculados a partir do createdAt */
export type NotificationItem = AdminNotification & {
  when: string;   // exemplo: Hoje 10:12
  ago: string;    // exemplo: 4d
  tag?: 'ALERTA' | 'INFO' | 'OK';
  meta?: string;
};

type Ctx = {
  list: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;

  // Seleção e expansão
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  isSelected: (id: string) => boolean;
  isExpanded: (id: string) => boolean;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  toggleExpand: (id: string) => void;

  // Ações disponíveis
  markSelectedRead: () => void;
  deleteSelected: () => void;
  markAllRead: () => void;
  deleteAll: () => void;
  markItemRead: (id: string) => void;
  removeItem: (id: string) => void;
  refresh: () => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

const formatWhen = (createdAt?: string) => {
  const dt = dayjs(createdAt);
  if (!dt.isValid()) return '—';
  const now = dayjs();
  if (dt.isSame(now, 'day')) return `Hoje ${dt.format('HH:mm')}`;
  if (dt.isSame(now.subtract(1, 'day'), 'day')) return `Ontem ${dt.format('HH:mm')}`;
  return dt.format('DD/MM/YYYY HH:mm');
};

const formatAgo = (createdAt?: string) => {
  const dt = dayjs(createdAt);
  if (!dt.isValid()) return '—';
  const now = dayjs();
  const minutes = Math.max(0, now.diff(dt, 'minute'));
  if (minutes < 60) return `${minutes}m`;
  const hours = now.diff(dt, 'hour');
  if (hours < 24) return `${hours}h`;
  const days = now.diff(dt, 'day');
  if (days < 30) return `${days}d`;
  const months = now.diff(dt, 'month');
  if (months < 12) return `${months}m`;
  return `${now.diff(dt, 'year')}a`;
};

const toTag = (n: AdminNotification): 'ALERTA' | 'INFO' | 'OK' | undefined => {
  if (n.severity === 'error' || n.severity === 'warning') return 'ALERTA';
  if (n.severity === 'info') return 'INFO';
  return undefined;
};

const decorate = (n: AdminNotification): NotificationItem => {
  const createdAt = n.createdAt ?? new Date().toISOString();
  return {
    ...n,
    createdAt,
    when: formatWhen(createdAt),
    ago: formatAgo(createdAt),
    tag: toTag(n),
  };
};

const decorateMany = (list: AdminNotification[]) => list.map(decorate);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelected] = useState<Set<string>>(new Set());
  const [expandedIds, setExpanded] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const qNotifications = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: listAdminNotifications,
    refetchOnWindowFocus: true,
    refetchInterval: 8000,
    staleTime: 5_000,
    enabled: isLoggedIn(),
    onError: notifyError,
  });

  const list = useMemo(
    () => (qNotifications.isEnabled ? decorateMany(qNotifications.data ?? []) : []),
    [qNotifications.data, qNotifications.isEnabled]
  );

  const unreadCount = useMemo(() => list.filter((n) => !n.read).length, [list]);

  const isSelected = (id: string) => selectedIds.has(id);
  const isExpanded = (id: string) => expandedIds.has(id);

  const refetch = () => {
    if (!isLoggedIn()) return;
    qc.invalidateQueries({ queryKey: ['admin-notifications'] });
  };

  const mMarkOne = useMutation({
    mutationFn: markAdminNotificationRead,
    onError: notifyError,
    onSettled: () => refetch(),
  });

  const mDelete = useMutation({
    mutationFn: deleteAdminNotification,
    onError: notifyError,
    onSettled: () => refetch(),
  });

  const mMarkAll = useMutation({
    mutationFn: markAllAdminNotificationsRead,
    onError: notifyError,
    onSettled: () => refetch(),
  });

  const markItemRead = (id: string) => {
    mMarkOne.mutate(id);
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removeItem = (id: string) => {
    mDelete.mutate(id);
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markSelectedRead = () => {
    const ids = Array.from(selectedIds);
    ids.forEach(id => markItemRead(id));
    clearSelection();
  };

  const deleteSelected = () => {
    const ids = Array.from(selectedIds);
    ids.forEach(id => removeItem(id));
    clearSelection();
  };

  const markAllRead = () => { mMarkAll.mutate(); clearSelection(); };
  const deleteAll = () => {
    list.forEach(n => removeItem(n.id));
    clearSelection();
  };

  const value: Ctx = {
    list,
    unreadCount,
    isLoading: qNotifications.isLoading,
    selectedIds, expandedIds,
    isSelected, isExpanded, toggleSelect, clearSelection, toggleExpand,
    markSelectedRead, deleteSelected, markAllRead, deleteAll,
    markItemRead, removeItem, refresh: refetch,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
