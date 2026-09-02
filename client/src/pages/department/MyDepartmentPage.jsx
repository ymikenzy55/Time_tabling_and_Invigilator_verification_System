import { useMemo } from 'react';
import { Award, BookOpen, GraduationCap, Layers } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyDepartment } from '@/features/academics/useMyDepartment';
import { useAuth } from '@/context/AuthContext';

const StatCard = ({ icon: Icon, label, value }) => (
  <div className="panel p-5 flex items-center gap-4">
    <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className="text-xl font-bold text-ink-900">{value}</div>
    </div>
  </div>
);

export const MyDepartmentPage = () => {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useMyDepartment();

  const department = data?.department || null;
  const placeholderMeta = data?.meta?.placeholder ? data.meta : null;
  const requestedName = placeholderMeta?.requestedName || user?.departmentName || null;

  const stats = useMemo(() => {
    if (!department?._count) return [];
    return [
      { icon: BookOpen, label: 'Courses', value: department._count.courses || 0 },
      { icon: Layers, label: 'Course levels', value: department._count.courseLevels || 0 },
    ];
  }, [department]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Department"
        description="Overview of your department footprint in the system."
        actions={department ? (
          <div className="text-sm text-ink-500">
            <span className="font-bold text-ink-900">{department.name}</span>
            {' • '}
            <span className="uppercase tracking-wide text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md">{department.code}</span>
          </div>
        ) : null}
      />

      {isLoading ? (
        <div className="panel p-10 grid place-items-center text-ink-400">
          <GraduationCap className="w-6 h-6 animate-pulse" />
          <p className="mt-3 text-sm">Fetching department details…</p>
        </div>
      ) : isError ? (
        <div className="panel p-10 text-sm text-rose-600">
          {error?.message || 'Unable to load department details. Please try again later.'}
        </div>
      ) : !department ? (
        <div className="panel p-10">
          <EmptyState
            icon={Award}
            title="Department not linked"
            description={requestedName
              ? `We couldn’t confirm access to the “${requestedName}” department. Contact the Examination Office so they can attach your account.`
              : 'We couldn’t confirm your department. Contact the Examination Office so they can attach your account.'}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
