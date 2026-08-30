import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Loader2, BookOpen, Building2, Clock, ArrowLeft, AlertTriangle, CheckCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { coursesApi } from '@/features/courses/coursesApi';
import { notificationsApi } from '@/features/notifications/notificationsApi';
import { cn } from '@/lib/cn';

const rejectSchema = z.object({
  comment: z.string().max(500).optional(),
});

export const CourseApprovalsPage = () => {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);

  const listQuery = useQuery({
    queryKey: ['courses', 'pending-approval'],
    queryFn: () => coursesApi.list({ status: 'SUBMITTED' }),
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const approveMutation = useMutation({
    mutationFn: (id) => coursesApi.approve(id, {}),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['courses', 'pending-approval'] });
      const prev = qc.getQueryData(['courses', 'pending-approval']);
      qc.setQueryData(['courses', 'pending-approval'], (old) =>
        Array.isArray(old) ? old.filter((c) => c.id !== id) : old
      );
      return { prev };
    },
    onSuccess: (course) => {
      toast.success('Course approved.');
      // Grab the full course object from pending-approval before removing it
      const pending = qc.getQueryData(['courses', 'pending-approval']) || [];
      const fullCourse = pending.find((c) => c.id === course.id);
      const merged = fullCourse ? { ...fullCourse, ...course } : course;
      qc.setQueryData(['courses', 'pending-approval'], (prev) =>
        Array.isArray(prev) ? prev.filter((c) => c.id !== course.id) : prev
      );
      // Update existing caches and prepend to the 'approved' cache
      qc.setQueriesData({ queryKey: ['courses'] }, (prev) => {
        if (!Array.isArray(prev)) return prev;
        const idx = prev.findIndex((c) => c.id === course.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...merged };
          return next;
        }
        return [merged, ...prev];
      });
      // Invalidate so any mounted or future queries refetch with fresh data
      qc.invalidateQueries({ queryKey: ['courses', { scope: 'approved' }] });
    },
    onSettled: () => setApprovingId(null),
  });

  const approveAllMutation = useMutation({
    mutationFn: (ids) => coursesApi.approveAll(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['courses', 'pending-approval'] });
      const prev = qc.getQueryData(['courses', 'pending-approval']);
      const idSet = new Set(ids);
      qc.setQueryData(['courses', 'pending-approval'], (old) =>
        Array.isArray(old) ? old.filter((c) => !idSet.has(c.id)) : old
      );
      return { prev };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(['courses', 'pending-approval'], ctx.prev);
      toast.error(err.message || 'Failed to approve courses.');
    },
    onSuccess: (data, ids) => {
      toast.success(`${data.approved} course${data.approved === 1 ? '' : 's'} approved.`);
      const approvedIds = new Set(ids);
      // Grab the full course objects from pending-approval before removing them
      const pending = qc.getQueryData(['courses', 'pending-approval']) || [];
      const approvedCourses = pending.filter((c) => approvedIds.has(c.id));
      qc.setQueryData(['courses', 'pending-approval'], (prev) =>
        Array.isArray(prev) ? prev.filter((c) => !approvedIds.has(c.id)) : prev
      );
      // Update existing caches and prepend approved courses where missing
      qc.setQueriesData({ queryKey: ['courses'] }, (prev) => {
        if (!Array.isArray(prev)) return prev;
        const existingIds = new Set(prev.map((c) => c.id));
        const updated = prev.map((c) =>
          approvedIds.has(c.id) ? { ...c, status: 'APPROVED', locked: true } : c
        );
        const toAdd = approvedCourses.filter((c) => !existingIds.has(c.id));
        return toAdd.length > 0 ? [...toAdd.map((c) => ({ ...c, status: 'APPROVED', locked: true })), ...updated] : updated;
      });
      // Invalidate so any mounted or future queries refetch with fresh data
      qc.invalidateQueries({ queryKey: ['courses', { scope: 'approved' }] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }) => coursesApi.reject(id, { comment }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['courses', 'pending-approval'] });
      const prev = qc.getQueryData(['courses', 'pending-approval']);
      qc.setQueryData(['courses', 'pending-approval'], (old) =>
        Array.isArray(old) ? old.filter((c) => c.id !== id) : old
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['courses', 'pending-approval'], ctx.prev);
      toast.error(err.message || 'Failed to reject course.');
    },
    onSuccess: (course) => {
      toast.success('Course rejected.');
      qc.setQueryData(['courses', 'pending-approval'], (prev) =>
        Array.isArray(prev) ? prev.filter((c) => c.id !== course.id) : prev
      );
      qc.setQueriesData({ queryKey: ['courses'] }, (prev) => {
        if (!Array.isArray(prev)) return prev;
        const idx = prev.findIndex((c) => c.id === course.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...course };
          return next;
        }
        return prev;
      });
      setRejecting(null);
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(rejectSchema),
  });

  const courses = listQuery.data || [];

  const departments = useMemo(() => {
    const map = new Map();
    courses.forEach((c) => {
      const dept = c.department;
      if (!dept?.id) return;
      if (!map.has(dept.id)) {
        map.set(dept.id, { ...dept, count: 0, levels: new Set() });
      }
      const entry = map.get(dept.id);
      entry.count += 1;
      if (c.level != null) entry.levels.add(c.level);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [courses]);

  const selectedDept = departments.find((d) => d.id === selectedDeptId) || null;

  useEffect(() => {
    if (selectedDeptId && !departments.some((d) => d.id === selectedDeptId)) {
      setSelectedDeptId(null);
      setSelectedLevel(null);
    }
  }, [departments, selectedDeptId]);

  const deptCourses = useMemo(
    () => courses.filter((c) => c.department?.id === selectedDeptId),
    [courses, selectedDeptId]
  );

  const deptLevels = useMemo(
    () => Array.from(new Set(deptCourses.map((c) => c.level).filter((l) => l != null))).sort((a, b) => a - b),
    [deptCourses]
  );

  const visibleCourses = selectedLevel
    ? deptCourses.filter((c) => c.level === selectedLevel)
    : deptCourses;

  useEffect(() => {
    notificationsApi
      .markReadByType('COURSE_SUBMITTED')
      .then(() => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      })
      .catch(() => {
        // silently ignore; the badge will clear on its next scheduled poll
      });
  }, [qc]);

  return (
    <>
      <PageHeader
        title="Course Approvals"
        description="Review courses submitted by department heads, department by department."
      />

      {courses.length > 0 && (
        <div className="panel border-amber-200 bg-amber-50 mb-5 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 grid place-items-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-sm text-amber-900">
            <span className="font-bold">{courses.length} course{courses.length === 1 ? '' : 's'}</span>
            {' '}awaiting your approval across{' '}
            <span className="font-bold">{departments.length} department{departments.length === 1 ? '' : 's'}</span>.
            Select a department below to review its submissions.
          </div>
        </div>
      )}

      {listQuery.isLoading ? (
        <SkeletonCardGrid count={6} lines={2} />
      ) : courses.length === 0 ? (
        <>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 mb-4 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="text-sm text-emerald-900">
            <span className="font-bold">All courses approved.</span>{' '}
            <span className="text-emerald-700">You can now generate the examination timetable from the All Courses page.</span>
          </div>
        </div>
        <EmptyState
          icon={BookOpen}
          title="No courses awaiting approval"
          description="Courses submitted by department heads will appear here for review."
        />
        </>
      ) : !selectedDept ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => { setSelectedDeptId(dept.id); setSelectedLevel(null); }}
              className="panel p-5 text-left hover:border-primary-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-700 grid place-items-center shrink-0 group-hover:bg-primary-100 transition-colors">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink-900 truncate">{dept.name}</div>
                  <div className="text-xs text-ink-500 truncate">{dept.code || '\u2014'}</div>
                </div>
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-bold bg-amber-100 text-amber-800 rounded-full shrink-0">
                  {dept.count}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                {dept.count} pending course{dept.count === 1 ? '' : 's'}
                {dept.levels.size > 0 && (
                  <span>· Level{dept.levels.size === 1 ? '' : 's'} {Array.from(dept.levels).sort((a, b) => a - b).join(', ')}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              className="btn-secondary btn-sm"
              onClick={() => { setSelectedDeptId(null); setSelectedLevel(null); }}
            >
              <ArrowLeft className="w-4 h-4" /> Back to departments
            </button>
            <div className="font-bold text-ink-900">{selectedDept.name}</div>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full px-2.5 py-1">
              <Clock className="w-3 h-3" /> {deptCourses.length} pending
            </span>
            <button
              className="btn-primary btn-sm ml-auto"
              onClick={() => approveAllMutation.mutate(visibleCourses.map((c) => c.id))}
              disabled={approveAllMutation.isPending || visibleCourses.length === 0}
            >
              {approveAllMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Approve all in department ({visibleCourses.length})
            </button>
          </div>

          {deptLevels.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLevel(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  !selectedLevel
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-ink-700 border-surface-border hover:bg-surface-subtle'
                )}
              >
                All levels
              </button>
              {deptLevels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    selectedLevel === lvl
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-ink-700 border-surface-border hover:bg-surface-subtle'
                  )}
                >
                  Level {lvl}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleCourses.map((course) => (
              <div key={course.id} className="panel p-5 border-l-4 border-l-amber-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-ink-900">{course.code} — {course.title}</div>
                    <div className="text-sm text-ink-500">
                      {course.department?.name} • {course.semester?.academicYear?.name} / {course.semester?.name}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full px-2.5 py-1 shrink-0">
                    <Clock className="w-3 h-3" /> Awaiting approval
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-ink-700">
                  <div>Level: {course.level}</div>
                  <div>Credits: {course.creditHours}</div>
                  <div>Students: {course.studentCount}</div>
                  <div>Exam duration: {course.examDurationMinutes} min</div>
                  <div className="col-span-2">Instructor: {course.instructorName || '\u2014'}</div>
                </div>

                {course.specialRequirements && (
                  <div className="mt-3 text-sm text-ink-600 bg-surface-subtle rounded-lg p-3">
                    <strong>Special requirements:</strong> {course.specialRequirements}
                  </div>
                )}

                <div className="mt-5 flex items-center gap-2">
                  <button
                    className="btn-primary flex-1"
                    onClick={() => {
                      setApprovingId(course.id);
                      approveMutation.mutate(course.id);
                    }}
                    disabled={approvingId === course.id}
                  >
                    {approvingId === course.id && <Loader2 className="w-4 h-4 animate-spin" />}
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                  <button
                    className="btn btn-md flex-1 text-rose-700 border border-rose-200 hover:bg-rose-50"
                    onClick={() => { setRejecting(course); reset(); }}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject course"
        description={`Rejecting ${rejecting?.code} — ${rejecting?.title}.`}
        size="sm"
      >
        <form className="space-y-3" onSubmit={handleSubmit((values) => rejectMutation.mutate({ id: rejecting.id, comment: values.comment }))}>
          <div>
            <label className="label">Rejection comment (optional)</label>
            <textarea className="input min-h-[100px]" placeholder="Reason for rejection..." {...register('comment')} />
            {errors.comment && <p className="field-error">{errors.comment.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
            <button type="submit" className="btn btn-md bg-rose-600 text-white hover:bg-rose-700" disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Reject course
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
