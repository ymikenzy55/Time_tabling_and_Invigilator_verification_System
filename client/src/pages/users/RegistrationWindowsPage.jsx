import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Calendar, Save, XCircle, Loader2, CheckCircle2, Clock,
  CalendarDays, CalendarOff, Users, ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { registrationApi } from '@/features/registration/registrationApi';
import { cn } from '@/lib/cn';

const roleLabels = {
  DEPARTMENT_HEAD: 'Department Heads',
  INVIGILATOR: 'Invigilators',
};

const roleIcons = {
  DEPARTMENT_HEAD: ShieldCheck,
  INVIGILATOR: Users,
};

const pad = (n) => `${n}`.padStart(2, '0');

const toDateInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parseDateOnly = (v) => {
  if (!v) return null;
  const [year, month, day] = v.split('-').map(Number);
  if ([year, month, day].some((n) => Number.isNaN(n))) return null;
  return new Date(year, month - 1, day);
};

const isOpen = (w) => {
  if (!w?.opensAt || !w?.closesAt) return false;
  const now = new Date();
  return new Date(w.opensAt) <= now && new Date(w.closesAt) >= now;
};

const isUpcoming = (w) => {
  if (!w?.opensAt) return false;
  return new Date(w.opensAt) > new Date();
};

const formatDate = (v) =>
  v ? new Date(v).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  }) : '—';

const formatDateTime = (v) =>
  v ? new Date(v).toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  }) : '—';

const WindowCard = ({ window: w }) => {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [editing, setEditing] = useState(false);
  const RoleIcon = roleIcons[w.role] || Users;

  useEffect(() => {
    setOpensAt(toDateInput(w.opensAt));
    setClosesAt(toDateInput(w.closesAt));
  }, [w.opensAt, w.closesAt]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const opens = parseDateOnly(opensAt);
      const closes = parseDateOnly(closesAt);
      opens.setHours(0, 0, 0, 0);
      closes.setHours(23, 59, 59, 999);
      return registrationApi.setWindow(w.role, {
        opensAt: opens.toISOString(),
        closesAt: closes.toISOString(),
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['registration', 'windows'] });
      const previous = qc.getQueriesData({ queryKey: ['registration', 'windows'] });
      return { previous };
    },
    onSuccess: (updated) => {
      toast.success(`${roleLabels[w.role]} registration window updated.`);
      qc.setQueryData(['registration', 'windows'], (prev) =>
        Array.isArray(prev) ? prev.map((item) => (item.role === updated.role ? updated : item)) : prev
      );
      qc.invalidateQueries({ queryKey: ['registration', 'status'] });
      setEditing(false);
    },
    onError: (err, _vars, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to update window.');
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => registrationApi.closeWindow(w.role),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['registration', 'windows'] });
      const previous = qc.getQueriesData({ queryKey: ['registration', 'windows'] });
      qc.setQueryData(['registration', 'windows'], (prev) =>
        Array.isArray(prev) ? prev.map((item) => (item.role === w.role ? { ...item, opensAt: null, closesAt: null } : item)) : prev
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success(`${roleLabels[w.role]} registration window closed.`);
      qc.invalidateQueries({ queryKey: ['registration', 'windows'] });
      qc.invalidateQueries({ queryKey: ['registration', 'status'] });
    },
    onError: (err, _vars, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to close window.');
    },
  });

  const open = isOpen(w);
  const upcoming = isUpcoming(w);
  const hasWindow = !!w.opensAt;

  const onSave = () => {
    const opens = parseDateOnly(opensAt);
    const closes = parseDateOnly(closesAt);
    if (!opens || !closes) {
      toast.error('Please provide valid start and end dates.');
      return;
    }
    if (closes.getTime() < opens.getTime()) {
      toast.error('End date cannot be before the start date.');
      return;
    }
    saveMutation.mutate();
  };

  const onClose = async () => {
    const ok = await confirm({
      title: `Close ${roleLabels[w.role]} registration?`,
      description: 'The register link will disappear from the login page until you set a new window.',
      confirmText: 'Close window',
      cancelText: 'Keep it open',
      tone: 'warning',
    });
    if (ok) closeMutation.mutate();
  };

  const statusConfig = open
    ? { variant: 'success', icon: CheckCircle2, label: 'Open', bg: 'bg-green-50', border: 'border-green-200' }
    : upcoming
    ? { variant: 'warning', icon: Clock, label: 'Upcoming', bg: 'bg-amber-50', border: 'border-amber-200' }
    : hasWindow
    ? { variant: 'neutral', icon: Clock, label: 'Closed', bg: 'bg-surface-subtle', border: 'border-surface-border' }
    : { variant: 'neutral', icon: CalendarOff, label: 'Not set', bg: 'bg-surface-subtle', border: 'border-surface-border' };

  const StatusIcon = statusConfig.icon;

  return (
    <div className={cn('panel overflow-hidden', open && 'ring-2 ring-primary-200')}>
      {/* Header band */}
      <div className={cn('px-5 py-4 border-b', statusConfig.border, statusConfig.bg)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-11 h-11 rounded-lg grid place-items-center', open ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'bg-white text-ink-500 border border-surface-border')}>
              <RoleIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-ink-900">{roleLabels[w.role]}</div>
              <div className="text-xs text-ink-500 mt-0.5">
                {hasWindow
                  ? `${formatDate(w.opensAt)} \u2192 ${formatDate(w.closesAt)}`
                  : 'No window configured'}
              </div>
            </div>
          </div>
          <Badge variant={statusConfig.variant}>
            <StatusIcon className="w-3 h-3" /> {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {hasWindow && !editing && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg bg-surface-subtle border border-surface-divider px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-500 mb-1">
                <CalendarDays className="w-3.5 h-3.5" /> Opens
              </div>
              <div className="text-sm font-bold text-ink-900">{formatDateTime(w.opensAt)}</div>
            </div>
            <div className="rounded-lg bg-surface-subtle border border-surface-divider px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-500 mb-1">
                <CalendarOff className="w-3.5 h-3.5" /> Closes
              </div>
              <div className="text-sm font-bold text-ink-900">{formatDateTime(w.closesAt)}</div>
            </div>
          </div>
        )}

        {(editing || !hasWindow) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-ink-400" /> Opens on
              </label>
              <input
                type="date"
                className="input"
                value={opensAt}
                min={toDateInput(new Date().toISOString())}
                onChange={(e) => {
                  setOpensAt(e.target.value);
                  if (closesAt && e.target.value > closesAt) {
                    setClosesAt(e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <CalendarOff className="w-3.5 h-3.5 text-ink-400" /> Closes on
              </label>
              <input
                type="date"
                className="input"
                value={closesAt}
                min={opensAt || toDateInput(new Date().toISOString())}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasWindow && !editing ? (
            <>
              <button
                className="btn-secondary flex-1"
                onClick={() => setEditing(true)}
              >
                <Calendar className="w-4 h-4" /> Edit dates
              </button>
              {open && (
                <button
                  className="btn btn-md text-rose-700 border border-rose-200 hover:bg-rose-50"
                  onClick={onClose}
                  disabled={closeMutation.isPending}
                >
                  {closeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Close now
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn-primary flex-1"
                onClick={onSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {hasWindow ? 'Save changes' : 'Open registration'}
              </button>
              {hasWindow && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setEditing(false);
                    setOpensAt(toDateInput(w.opensAt));
                    setClosesAt(toDateInput(w.closesAt));
                  }}
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const RegistrationWindowsPage = () => {
  const listQuery = useQuery({
    queryKey: ['registration', 'windows'],
    queryFn: () => registrationApi.listWindows(),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const windows = listQuery.data || [];
  const openCount = windows.filter(isOpen).length;

  return (
    <>
      <PageHeader
        title="Registration Windows"
        description="Control when Department Heads and Invigilators can self-register from the login page."
        actions={openCount > 0 ? (
          <span className="rounded-md bg-primary-50 text-primary-700 border border-primary-200 text-xs font-bold px-3 py-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {openCount} window{openCount === 1 ? '' : 's'} open
          </span>
        ) : undefined}
      />

      {listQuery.isLoading ? (
        <SkeletonCardGrid count={4} lines={3} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {windows.map((w) => (
            <WindowCard key={w.role} window={w} />
          ))}
        </div>
      )}
    </>
  );
};
