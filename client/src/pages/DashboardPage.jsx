import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/features/dashboard/dashboardApi';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, Clock, ClipboardList, ScanLine, Calendar, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

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

  // For invigilators, fetch their assignments for more detailed stats
  const assignmentsQuery = useQuery({
    queryKey: ['myVenueAssignments'],
    queryFn: venueAssignmentsApi.myAssignments,
    enabled: user?.role === 'INVIGILATOR',
    staleTime: 30_000,
  });

  const stats = data?.stats || [];
  const recentActivity = data?.recentActivity || [];
  const assignments = assignmentsQuery.data || [];

  // Calculate invigilator-specific stats
  const totalSlots = assignments.length;
  const scannedCount = assignments.filter(a => a.scanned).length;
  const upcomingCount = assignments.filter(a => !a.scanned && new Date(a.slotAt) >= new Date()).length;
  const todayCount = assignments.filter(a => {
    const today = new Date();
    const slotDate = new Date(a.slotAt);
    return slotDate.toDateString() === today.toDateString();
  }).length;

  // Find next duty
  const nextDuty = assignments
    .filter(a => !a.scanned && new Date(a.slotAt) >= new Date())
    .sort((a, b) => new Date(a.slotAt) - new Date(b.slotAt))[0];

  const isInvigilator = user?.role === 'INVIGILATOR';

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName?.split(' ')[0] || 'there'}`}
        description={isInvigilator
          ? 'Your invigilation schedule and quick actions.'
          : user?.role === 'DEPARTMENT_HEAD' && user?.departmentName
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
        <DashboardSkeleton />
      ) : isInvigilator ? (
        <InvigilatorDashboard
          totalSlots={totalSlots}
          scannedCount={scannedCount}
          upcomingCount={upcomingCount}
          todayCount={todayCount}
          nextDuty={nextDuty}
          recentActivity={recentActivity}
          assignmentsLoading={assignmentsQuery.isLoading}
        />
      ) : (
        <AdminDashboard stats={stats} recentActivity={recentActivity} />
      )}
    </>
  );
};

const InvigilatorDashboard = ({ totalSlots, scannedCount, upcomingCount, todayCount, nextDuty, recentActivity, assignmentsLoading }) => {
  const kpis = [
    { label: 'Total Assignments', value: totalSlots, icon: ClipboardList, color: 'primary', link: '/my-assignments' },
    { label: 'Checked In', value: scannedCount, icon: CheckCircle2, color: 'primary', link: '/attendance/history' },
    { label: 'Upcoming', value: upcomingCount, icon: Calendar, color: 'primary', link: '/my-assignments' },
    { label: 'Today', value: todayCount, icon: Clock, color: todayCount > 0 ? 'primary' : 'neutral', link: '/my-assignments' },
  ];

  const quickActions = [
    { label: 'View My Schedule', icon: ClipboardList, link: '/my-assignments', description: 'See all your assigned venues and times' },
    { label: 'Scan QR Code', icon: ScanLine, link: '/scan', description: 'Check in at your assigned venue' },
    { label: 'Attendance History', icon: Activity, link: '/attendance/history', description: 'View your past scan records' },
  ];

  // Check if scan is available (30 min before exam start, until exam end)
  const now = new Date();
  const isScanAvailable = nextDuty ? (() => {
    const slotTime = new Date(nextDuty.slotAt);
    const examDuration = nextDuty.examDurationMinutes || 180; // Default 3 hours
    const scanOpenTime = new Date(slotTime.getTime() - 30 * 60 * 1000); // 30 min before
    const examEndTime = new Date(slotTime.getTime() + examDuration * 60 * 1000);
    return now >= scanOpenTime && now <= examEndTime;
  })() : false;

  const timeUntilScan = nextDuty ? (() => {
    const slotTime = new Date(nextDuty.slotAt);
    const scanOpenTime = new Date(slotTime.getTime() - 30 * 60 * 1000);
    const diffMs = scanOpenTime - now;
    if (diffMs <= 0) return null;
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  })() : null;

  return (
    <div className="space-y-4">
      {/* KPI Cards - 2x2 grid on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={i}
              to={kpi.link}
              className="panel p-4 hover:border-primary-300 transition-all hover:shadow-card group"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs text-ink-500 font-medium">{kpi.label}</div>
                    <div className="mt-1 text-2xl font-bold text-ink-900 group-hover:text-primary-700 transition-colors">
                      {assignmentsLoading ? <Skeleton className="h-7 w-12" /> : kpi.value}
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-600 border border-${kpi.color}-100 grid place-items-center group-hover:scale-110 transition-transform shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Next Duty Card - Compact on mobile */}
      {assignmentsLoading ? (
        <div className="panel p-4">
          <Skeleton className="h-5 w-32 mb-3" />
          <Skeleton className="h-16" />
        </div>
      ) : nextDuty ? (
        <div className="panel p-4 bg-gradient-to-r from-primary-50 to-white border-l-4 border-l-primary-600">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-600 text-white grid place-items-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-ink-900">Next Duty</h3>
                  <Badge variant="primary" className="text-xs">Upcoming</Badge>
                </div>
                <div className="text-xs text-ink-700">
                  <span className="font-semibold">{new Date(nextDuty.slotAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                <div className="text-xs text-ink-600">
                  <span className="font-semibold">{new Date(nextDuty.slotAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </div>
                <div className="text-xs text-ink-600 mt-0.5">
                  <span className="font-semibold">{nextDuty.venue?.name}</span>
                  {nextDuty.venue?.location && ` · ${nextDuty.venue.location}`}
                </div>
              </div>
            </div>
            {isScanAvailable ? (
              <Link
                to="/scan"
                className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                Scan Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : timeUntilScan ? (
              <div className="w-full py-2.5 bg-ink-100 text-ink-600 text-sm font-medium rounded-lg flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Opens in {timeUntilScan}
              </div>
            ) : (
              <div className="w-full py-2.5 bg-rose-100 text-rose-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Scan window closed
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="panel p-4 bg-surface-subtle border border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ink-100 text-ink-400 grid place-items-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-ink-900">All Caught Up!</h3>
              <p className="text-xs text-ink-600">You have no upcoming invigilation duties.</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions - Stack vertically on mobile */}
      <div className="panel p-4">
        <h3 className="text-sm font-bold text-ink-900 mb-3">Quick Actions</h3>
        <div className="space-y-2">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link
                key={i}
                to={action.link}
                className="flex items-center gap-3 p-3 rounded-lg border border-surface-border hover:border-primary-300 hover:bg-surface-subtle transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink-900 group-hover:text-primary-700 transition-colors">{action.label}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{action.description}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-primary-600 transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity - Compact on mobile */}
      <div className="panel p-4">
        <h3 className="text-sm font-bold text-ink-900 mb-3">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={Clock}
              title="No recent activity"
              description="Recent events relevant to your role will appear here."
            />
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentActivity.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface-subtle border border-surface-divider">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-ink-900 truncate">
                    {ACTIVITY_LABELS[a.action] || a.action || a.label}
                  </div>
                  {a.actor?.fullName && (
                    <div className="text-xs text-ink-400 mt-0.5 truncate">By {a.actor.fullName}</div>
                  )}
                </div>
                <div className="text-xs text-ink-400 whitespace-nowrap shrink-0">
                  {new Date(a.createdAt || a.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ stats, recentActivity }) => (
  <div className="space-y-5">
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

    <div className="panel p-5">
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
  </div>
);

const DashboardSkeleton = () => (
  <>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="panel p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="w-12 h-12 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
    <div className="panel p-5">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-20" />
    </div>
    <div className="panel p-5">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-subtle border border-surface-divider">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  </>
);
