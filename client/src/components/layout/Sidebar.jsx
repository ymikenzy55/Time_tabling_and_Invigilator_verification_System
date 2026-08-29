import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { filterNavForRole } from '@/config/nav';
import { usersApi } from '@/features/users/usersApi';
import { coursesApi } from '@/features/courses/coursesApi';
import { courseLevelsApi } from '@/features/courses/courseLevelsApi';
import { semestersApi } from '@/features/academics/semestersApi';
import { venueAssignmentsApi } from '@/features/venueAssignments/venueAssignmentsApi';
import { notificationsApi } from '@/features/notifications/notificationsApi';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Exam Officer',
  DEPARTMENT_HEAD: 'Department Head',
  INVIGILATOR: 'Invigilator',
};

/**
 * Fixed left service navigation — console style.
 * - Light panel with a service-title header
 * - Active item: bold green label + green left accent bar (never a filled pill)
 * - Collapsible groups with chevron
 */
export const Sidebar = ({ open = true }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = filterNavForRole(user?.role);

  const pendingQuery = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => usersApi.listPendingApprovals(),
    enabled: user?.role === 'SUPER_ADMIN',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const pendingCount = (pendingQuery.data || []).length;

  const pendingCoursesQuery = useQuery({
    queryKey: ['courses', 'pending-approval'],
    queryFn: () => coursesApi.list({ status: 'SUBMITTED' }),
    enabled: user?.role === 'SUPER_ADMIN',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
  const pendingCourseCount = (pendingCoursesQuery.data || []).length;

  const courseLevelsQuery = useQuery({
    queryKey: ['course-levels', { scope: 'sidebar' }],
    queryFn: async () => {
      const { levels = [] } = await courseLevelsApi.list();
      return levels;
    },
    enabled: user?.role === 'DEPARTMENT_HEAD',
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const semestersQuery = useQuery({
    queryKey: ['semesters', { scope: 'sidebar' }],
    queryFn: () => semestersApi.list(),
    enabled: user?.role === 'DEPARTMENT_HEAD',
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const todayCountQuery = useQuery({
    queryKey: ['venue-assignments', 'today-count'],
    queryFn: venueAssignmentsApi.todayCount,
    enabled: user?.role === 'INVIGILATOR',
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const todayDutyCount = todayCountQuery.data || 0;
  const lastSeenDate = typeof window !== 'undefined' ? localStorage.getItem('invigilator-last-seen-duties') : null;
  const today = new Date().toDateString();
  const showDutyBadge = todayDutyCount > 0 && lastSeenDate !== today;

  const location = useLocation();

  const markReadByTypeMutation = useMutation({
    mutationFn: (type) => notificationsApi.markReadByType(type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  useEffect(() => {
    const path = location.pathname;
    const typeMap = {
      '/approvals': 'PENDING_ACCOUNT',
      '/course-approvals': 'COURSE_SUBMITTED',
      '/invigilator-assignments': 'INVIGILATOR_CHECKIN',
    };
    const type = typeMap[path];
    if (type) {
      markReadByTypeMutation.mutate(type);
    }
    if (path === '/my-assignments') {
      localStorage.setItem('invigilator-last-seen-duties', new Date().toDateString());
    }
  }, [location.pathname]);

  return (
    <aside
      className={cn(
        'hidden lg:flex fixed top-14 bottom-0 left-0 z-30 bg-white border-r border-surface-border transition-all duration-300 ease-in-out overflow-hidden flex-col',
        open ? 'w-64' : 'w-16'
      )}
    >
      {open && (
        <div className="px-4 py-3 border-b border-surface-border shrink-0">
          <div className="text-base font-bold text-ink-900 leading-tight truncate">
            {ROLE_LABELS[user?.role] || 'Console'}
          </div>
          <div className="text-2xs text-ink-500 mt-0.5 truncate">Examination Manager</div>
        </div>
      )}
      <nav className={cn('py-3 overflow-y-auto flex-1', open ? 'px-2' : 'px-1')}>
        {nav.map((entry) =>
          entry.kind === 'item' ? (
            <SidebarItem key={entry.to} entry={entry} expanded={open} />
          ) : (
            <SidebarGroup
              key={entry.label}
              entry={entry}
              pendingCount={pendingCount}
              pendingCourseCount={pendingCourseCount}
              courseLevels={courseLevelsQuery.data || []}
              courseLevelsLoading={courseLevelsQuery.isLoading}
              semesters={semestersQuery.data || []}
              showDutyBadge={showDutyBadge}
              expanded={open}
            />
          )
        )}
      </nav>
    </aside>
  );
};

const SEMESTER_SLUGS = [
  { slug: 'first', label: 'First Semester', match: (name) => name.trim().toLowerCase().includes('first') },
  { slug: 'second', label: 'Second Semester', match: (name) => name.trim().toLowerCase().includes('second') },
];

const SidebarSemesterNested = ({ entry, levels = [], loading, semesters = [], expanded = true }) => {
  const location = useLocation();
  const hasActiveChild = location.pathname.startsWith(entry.to);
  const [open, setOpen] = useState(hasActiveChild);
  const Icon = entry.icon;

  const semesterGroups = SEMESTER_SLUGS.map((s) => ({
    ...s,
    semester: semesters.find((sem) => s.match(sem.name)),
  }));

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
          hasActiveChild ? 'text-primary-700 font-bold' : 'text-ink-700 font-medium hover:bg-surface-subtle'
        )}
      >
        {Icon && (
          <Icon className={cn('w-4 h-4 shrink-0', hasActiveChild ? 'text-primary-600' : 'text-ink-400')} />
        )}
        {expanded && <span className="flex-1 text-left truncate">{entry.label}</span>}
        {expanded && <ChevronDown className={cn('w-4 h-4 text-ink-400 transition-transform', open && 'rotate-180')} />}
      </button>

      {open && (
        <div className="ml-4 pl-3 border-l border-dashed border-surface-border space-y-0.5">
          {semesterGroups.map((sg) => (
            <SidebarSemesterItem
              key={sg.slug}
              slug={sg.slug}
              label={sg.label}
              basePath={entry.to}
              levels={levels}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SidebarSemesterItem = ({ slug, label, basePath, levels = [], loading }) => {
  const location = useLocation();
  const hasActiveChild = location.pathname.startsWith(`${basePath}/${slug}`);
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
          hasActiveChild ? 'text-primary-700 font-bold' : 'text-ink-700 font-medium hover:bg-surface-subtle'
        )}
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="ml-4 pl-3 border-l border-dashed border-surface-border space-y-0.5">
          {loading ? (
            <div className="px-3 py-1.5 text-xs text-ink-400">Loading levels…</div>
          ) : levels.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-ink-400">No levels yet</div>
          ) : (
            levels.map((level) => {
              const target = `${basePath}/${slug}/${level.value}`;
              return (
                <NavLink
                  key={level.id || level.value}
                  to={target}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-800 font-bold before:absolute before:-left-3 before:top-1 before:bottom-1 before:w-0.5 before:rounded-r before:bg-primary-600'
                        : 'text-ink-700 hover:bg-surface-subtle'
                    )
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                  <span className="flex-1 truncate">Level {level.value}</span>
                </NavLink>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ entry, expanded = true }) => {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'text-primary-800 bg-primary-50 font-bold'
            : 'text-ink-700 font-medium hover:bg-surface-subtle'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary-600" />
          )}
          {Icon && (
            <Icon
              className={cn(
                'w-5 h-5 shrink-0',
                !expanded && 'mx-auto',
                isActive ? 'text-primary-600' : 'text-ink-500 group-hover:text-ink-700'
              )}
            />
          )}
          {expanded && <span className="truncate">{entry.label}</span>}
        </>
      )}
    </NavLink>
  );
};

const SidebarGroup = ({ entry, pendingCount = 0, pendingCourseCount = 0, courseLevels = [], courseLevelsLoading = false, semesters = [], showDutyBadge = false, expanded = true }) => {
  const location = useLocation();
  const hasActiveChild = entry.items.some((i) => location.pathname.startsWith(i.to));
  const [open, setOpen] = useState(hasActiveChild);
  const Icon = entry.icon;
  const hasDutiesToday = showDutyBadge && entry.items?.some((i) => i.to === '/my-assignments');

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => expanded && setOpen((v) => !v)}
        className={cn(
          'w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          hasActiveChild ? 'text-primary-700 font-bold' : 'text-ink-700 font-medium hover:bg-surface-subtle'
        )}
      >
        {Icon && (
          <div className={cn('relative shrink-0', !expanded && 'mx-auto')}>
            <Icon className={cn('w-5 h-5', hasActiveChild ? 'text-primary-600' : 'text-ink-500')} />
            {entry.items?.some((i) => i.to === '/approvals') && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
            )}
            {entry.items?.some((i) => i.to === '/course-approvals') && pendingCourseCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
            )}
            {hasDutiesToday && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary-600 animate-pulse" />
            )}
          </div>
        )}
        {expanded && <span className="flex-1 text-left truncate">{entry.label}</span>}
        {expanded && (
          <ChevronDown
            className={cn('w-4 h-4 text-ink-400 transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {expanded && open && (
        <div className="mt-1 ml-4 pl-3 border-l border-surface-border space-y-0.5">
          {entry.items.map((child) => {
            if (child.type === 'course-semester-level-links') {
              return (
                <SidebarSemesterNested
                  key={child.label}
                  entry={child}
                  levels={courseLevels}
                  loading={courseLevelsLoading}
                  semesters={semesters}
                />
              );
            }
            const isApprovals = child.to === '/approvals';
            const isCourseApprovals = child.to === '/course-approvals';
            const isDuties = child.to === '/my-assignments';
            const count = isCourseApprovals ? pendingCourseCount : pendingCount;
            const showBadge = (isApprovals || isCourseApprovals) && count > 0;
            const showDutyBadgeOnItem = isDuties && showDutyBadge;
            return (
              <NavLink
                key={child.to}
                to={child.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-800 font-bold before:absolute before:-left-3 before:top-1 before:bottom-1 before:w-0.5 before:rounded-r before:bg-primary-600'
                      : 'text-ink-700 hover:bg-surface-subtle'
                  )
                }
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                <span className="truncate flex-1">{child.label}</span>
                {showBadge && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold bg-rose-600 text-white rounded-full">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
                {showDutyBadgeOnItem && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold bg-primary-600 text-white rounded-full">
                    Today
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
};
