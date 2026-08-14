import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { dashboardApi } from '@/features/dashboard/dashboardApi';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, Clock } from 'lucide-react';

const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  DEPARTMENT_HEAD: 'Department Head',
  INVIGILATOR: 'Invigilator',
};

const ACTIVITY_LABELS = {
  'USER.APPROVE': 'Account approved',
  'USER.REJECT': 'Account rejected',
  'USER.DELETE': 'User deleted',
  'USER.CHANGE_PASSWORD': 'Password changed',
  'COURSE.CREATE': 'Course created',
  'COURSE.UPDATE': 'Course updated',
  'COURSE.SUBMIT': 'Course submitted',
  'COURSE.APPROVE': 'Course approved',
  'COURSE.REJECT': 'Course rejected',
  'COURSE.DELETE': 'Course deleted',
  'INVIGILATION.CREATE': 'Invigilation assigned',
  'INVIGILATION.UPDATE': 'Invigilation updated',
  'INVIGILATION.REPLACE': 'Invigilator replaced',
  'INVIGILATION.DELETE': 'Invigilation removed',
  'USER.REGISTER': 'User registered',
  'REGISTRATION.WINDOW_SET': 'Registration window set',
  'REGISTRATION.WINDOW_CLOSE': 'Registration window closed',
  'ACCOUNT_APPROVED': 'Account approved',
  'ACCOUNT_REJECTED': 'Account rejected',
  'APPROVAL_PENDING': 'Approval pending',
  'COURSE_SUBMITTED': 'Course submitted',
  'COURSE_APPROVED': 'Course approved',
  'COURSE_REJECTED': 'Course rejected',
  'INVIGILATION_ASSIGNED': 'Invigilation assigned',
  'INVIGILATION_REPLACEMENT': 'Invigilator replaced',
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardApi.summary,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const stats = data?.stats || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <>
      <div className="panel p-5 mb-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-lg bg-surface-subtle border border-surface-border grid place-items-center overflow-hidden shrink-0">
          <img src="/assets/images/uenrLogo.png" alt="UENR" className="w-12 h-12 object-contain" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-ink-500">
            University of Energy and Natural Resources
          </div>
          <div className="text-lg font-bold leading-tight text-ink-900">Examination Management System</div>
          <div className="text-sm text-ink-500 mt-0.5">
            Signed in as {ROLE_LABEL[user?.role] || user?.role}
            {user?.role === 'DEPARTMENT_HEAD' && user?.departmentName ? (
              <> · <span className="text-ink-700 font-bold">{user.departmentName}</span></>
            ) : null}
          </div>
        </div>
      </div>

      <PageHeader
        title={`Welcome, ${user?.fullName?.split(' ')[0] || 'there'}`}
        description={user?.role === 'DEPARTMENT_HEAD' && user?.departmentName
          ? `Overview for the ${user.departmentName} department.`
          : 'Here is an overview of activity across the platform.'}
        actions={(
          <Badge variant="primary">
            {user?.role === 'DEPARTMENT_HEAD' && user?.departmentName
              ? `${ROLE_LABEL[user.role]} · ${user.departmentName}`
              : ROLE_LABEL[user?.role] || user?.role}
          </Badge>
        )}
      />

      {isLoading ? (
        <div className="panel p-6 text-sm text-ink-500">Loading dashboard…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {stats.map((s) => (
              <Link
                key={s.key}
                to={s.link || '#'}
                className="panel p-5 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-ink-500">{s.label}</div>
                    <div className="mt-2 text-2xl font-bold text-ink-900">{s.value}</div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 panel p-5">
            <h3 className="text-base font-bold text-ink-900">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  icon={Clock}
                  title="No recent activity"
                  description="Recent events relevant to your role will appear here."
                />
              </div>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-subtle border border-surface-divider">
                    <div className="min-w-0">
                      <div className="font-bold text-ink-900">
                        {ACTIVITY_LABELS[a.action] || a.action || a.label}
                      </div>
                      {a.label && a.label !== a.action && (
                        <div className="text-xs text-ink-500 truncate">{a.label}</div>
                      )}
                      {a.actor?.fullName && (
                        <div className="text-xs text-ink-400 mt-0.5">By {a.actor.fullName}</div>
                      )}
                    </div>
                    <div className="text-xs text-ink-400 whitespace-nowrap">
                      {new Date(a.createdAt || a.scheduledAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
};
