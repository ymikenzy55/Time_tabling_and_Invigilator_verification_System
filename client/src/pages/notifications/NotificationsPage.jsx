import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Inbox, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { notificationsApi } from '@/features/notifications/notificationsApi';

const FILTERS = [
  { id: 'unread', label: 'Unread' },
  { id: 'all', label: 'All' },
];

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

export const NotificationsPage = () => {
  const [filter, setFilter] = useState('unread');
  const qc = useQueryClient();

  const queryKey = useMemo(() => ['notifications', { view: filter }], [filter]);

  const params = useMemo(() => (
    filter === 'unread'
      ? { unread: true, limit: 200 }
      : { limit: 200 }
  ), [filter]);

  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () => notificationsApi.list(params),
    staleTime: 60_000,
    keepPreviousData: true,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: (_res, id) => {
      qc.setQueriesData({ queryKey: ['notifications'] }, (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((n) => n.id !== id);
      });
      qc.setQueriesData({ queryKey }, (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.setQueriesData({ queryKey: ['notifications'] }, () => []);
      qc.setQueryData(['notifications', 'unread-count'], () => 0);
    },
  });

  const notifications = notificationsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay on top of system activity across your account."
        actions={(
          <button
            type="button"
            className="btn-secondary"
            onClick={() => markAllReadMutation.mutate()}
            disabled={notifications.length === 0 || markAllReadMutation.isPending}
          >
            {markAllReadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Mark all read
          </button>
        )}
      />

      <div className="panel">
        <div className="border-b border-surface-border flex items-center justify-between px-4 py-3 gap-3 flex-wrap bg-surface-subtle">
          <div className="flex items-center gap-0.5">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`px-3 py-1.5 text-sm rounded-md font-bold transition-colors ${
                  filter === item.id
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-ink-500 hover:text-ink-900 hover:bg-surface-subtle'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link to="/profile" className="link-info">
            Manage notification preferences
          </Link>
        </div>

        {notificationsQuery.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 border-b border-surface-divider last:border-0">
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-center text-ink-500">
            <Inbox className="w-10 h-10 mb-3 text-ink-300" />
            <p className="text-sm font-medium">No {filter === 'unread' ? 'unread' : ''} notifications</p>
            <p className="text-xs mt-1 max-w-sm">
              Activity will appear here as you manage departments, courses, invigilations, and approvals.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-divider">
            {notifications.map((notification) => (
              <li key={notification.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:gap-4 hover:bg-surface-subtle transition">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notification.isRead ? 'bg-surface-border' : 'bg-primary-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-ink-900">{notification.title}</h3>
                      <p className="text-xs text-ink-500 mt-1 whitespace-pre-line break-words">
                        {notification.message}
                      </p>
                    </div>
                    <time className="text-xs text-ink-400 shrink-0">
                      {formatDate(notification.createdAt)}
                    </time>
                  </div>
                  {notification.link && (
                    <Link
                      to={notification.link}
                      className="link-info inline-flex items-center gap-1 mt-3"
                      onClick={() => setFilter('unread')}
                    >
                      View details
                    </Link>
                  )}
                </div>
                {!notification.isRead && (
                  <button
                    type="button"
                    className="btn-ghost text-xs mt-3 sm:mt-0"
                    onClick={() => markReadMutation.mutate(notification.id)}
                    disabled={markReadMutation.isPending}
                  >
                    <Check className="w-4 h-4" /> Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
