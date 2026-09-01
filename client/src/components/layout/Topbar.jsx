import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Menu, X, Check, Loader2, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { notificationsApi } from '@/features/notifications/notificationsApi';
import { getSocket, disconnectSocket } from '@/lib/socket';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Exam Officer',
  DEPARTMENT_HEAD: 'Department Head',
  INVIGILATOR: 'Invigilator',
};

export const Topbar = ({ onToggleSidebar, sidebarOpen = true }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [streamConnected, setStreamConnected] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    refetchInterval: streamConnected ? false : 30000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: streamConnected ? false : 30000,
  });
  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: (_res, id) => {
      qc.setQueryData(['notifications'], (prev) =>
        (prev || []).map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.setQueryData(['notifications'], (prev) =>
        (prev || []).map((n) => ({ ...n, isRead: true }))
      );
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  useEffect(() => {
    const onClick = (e) => {
      if (!notifRef.current?.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);


  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => setStreamConnected(true);
    const onDisconnect = () => setStreamConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setStreamConnected(true);

    const handleNotification = (data) => {
      const notification = data?.notification;
      if (!notification || notification.isRead) return;
      qc.setQueryData(['notifications'], (prev = []) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, 50);
      });
      qc.setQueryData(['notifications', 'unread-count'], (prev = 0) => prev + 1);
    };

    const handlePendingAccount = (data) => {
      if (data?.fullName) {
        toast.success(`${data.fullName} registered and is awaiting approval.`, { duration: 3500 });
      }
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      qc.invalidateQueries({ queryKey: ['approvals', 'pending'] });
    };

    const handleCourseSubmitted = () => {
      toast.success('A course has been submitted for approval.', { duration: 3500 });
      qc.invalidateQueries({ queryKey: ['courses', 'pending-approval'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };

    const handleCourseUpdated = () => {
      qc.invalidateQueries({ queryKey: ['courses', 'pending-approval'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
    };

    const handleCourseApproved = () => {
      toast.success('Course approved.', { duration: 3500 });
      qc.invalidateQueries({ queryKey: ['courses', 'pending-approval'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };

    const handleCourseRejected = () => {
      toast.success('Course rejected.', { duration: 3500 });
      qc.invalidateQueries({ queryKey: ['courses', 'pending-approval'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };

    const handleInvigilatorCheckin = (data) => {
      const name = data?.invigilator?.fullName || 'An invigilator';
      const venueName = data?.venue?.name || 'a venue';
      const time = data?.scannedAt
        ? new Date(data.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      toast.success(`${name} checked in at ${venueName}${time ? ` — ${time}` : ''}.`, { duration: 3500, icon: '✓' });
      qc.invalidateQueries({ queryKey: ['venue-scans'] });
      qc.invalidateQueries({ queryKey: ['myVenueScans'] });
      qc.invalidateQueries({ queryKey: ['myVenueAssignments'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['venueScans'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };

    socket.on('notification.created', handleNotification);
    socket.on('pending-account', handlePendingAccount);
    socket.on('course-submitted', handleCourseSubmitted);
    socket.on('course-updated', handleCourseUpdated);
    socket.on('course-approved', handleCourseApproved);
    socket.on('course-rejected', handleCourseRejected);
    socket.on('invigilator-checkin', handleInvigilatorCheckin);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification.created', handleNotification);
      socket.off('pending-account', handlePendingAccount);
      socket.off('course-submitted', handleCourseSubmitted);
      socket.off('course-updated', handleCourseUpdated);
      socket.off('course-approved', handleCourseApproved);
      socket.off('course-rejected', handleCourseRejected);
      socket.off('invigilator-checkin', handleInvigilatorCheckin);
    };
  }, [qc, user?.id]);

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      description: 'You will be returned to the sign-in page and will need to enter your credentials again.',
      confirmText: 'Sign out',
      cancelText: 'Stay signed in',
      tone: 'warning',
    });
    if (!ok) return;
    disconnectSocket();
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.fullName || 'U')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="h-14 bg-chrome border-b border-chrome-border fixed top-0 left-0 right-0 z-40 no-print">
      <div className="h-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden xl:flex p-2 rounded-md text-chrome-text hover:bg-chrome-hover hover:text-white shrink-0 transition-colors"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <Link to="/dashboard" className="flex items-center gap-2 shrink-0 rounded-md px-1 py-1 hover:bg-chrome-hover transition-colors">
          <div className="w-7 h-7 rounded grid place-items-center overflow-hidden shrink-0 bg-white/95">
            <img src="/assets/images/uenrLogo.png" alt="UENR" className="w-6 h-6 object-contain" />
          </div>
          <span className="hidden sm:block text-sm font-bold text-white leading-none">
            Examination Manager
          </span>
        </Link>

        <span className="hidden xl:inline-block h-5 w-px bg-chrome-border mx-1" />
        <span className="hidden xl:inline-block text-xs text-chrome-text">
          {ROLE_LABELS[user?.role] || 'User'}
        </span>

        {/* Right cluster: pushed to the far right on ALL breakpoints */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="relative" ref={notifRef}>
            <button
              className="p-2 rounded-md text-chrome-text hover:bg-chrome-hover hover:text-white relative shrink-0 transition-colors"
              aria-label="Notifications"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 text-[10px] font-bold bg-primary-500 text-chrome rounded-full grid place-items-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="fixed right-2 sm:right-4 top-14 sm:top-14 w-[calc(100vw-1rem)] max-w-sm bg-white rounded-lg shadow-popover border border-surface-border z-50 overflow-hidden">
                <div className="p-3 border-b border-surface-border flex items-center justify-between gap-3 bg-surface-subtle">
                  <div className="flex flex-col">
                    <div className="text-sm font-bold text-ink-900">Notifications</div>
                    <Link
                      to="/notifications"
                      className="text-xs text-primary-700 hover:text-primary-800"
                      onClick={() => setNotifOpen(false)}
                    >
                      View all activity
                    </Link>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-xs text-primary-700 hover:text-primary-800 flex items-center gap-1"
                      disabled={markAllReadMutation.isPending}
                    >
                      {markAllReadMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      <Check className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 flex flex-col items-center text-center text-ink-500">
                      <Inbox className="w-8 h-8 mb-2 text-ink-300" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (n.link) navigate(n.link);
                          if (!n.isRead) markReadMutation.mutate(n.id);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-surface-divider hover:bg-surface-subtle transition-colors ${
                          n.isRead ? 'opacity-70' : 'bg-primary-50/60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? 'bg-surface-border' : 'bg-primary-600'}`} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-ink-900 truncate">{n.title}</div>
                            <div className="text-xs text-ink-500 leading-relaxed line-clamp-2">{n.message}</div>
                            <div className="text-[10px] text-ink-400 mt-1">
                              {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            to="/profile"
            className="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-3 ml-1 border-l border-chrome-border hover:bg-chrome-hover rounded-md transition-colors py-1 pr-1.5"
            title="View profile"
          >
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-sm font-bold text-white truncate max-w-[180px]">
                {user?.fullName}
              </div>
              {user?.role === 'DEPARTMENT_HEAD' && user?.departmentName ? (
                <div className="text-[11px] text-chrome-text truncate max-w-[180px]">
                  {user.departmentName}
                </div>
              ) : null}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-600 text-white grid place-items-center text-xs font-bold shrink-0">
              {initials}
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="p-2 rounded-md text-chrome-text hover:bg-chrome-hover hover:text-white shrink-0 transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
