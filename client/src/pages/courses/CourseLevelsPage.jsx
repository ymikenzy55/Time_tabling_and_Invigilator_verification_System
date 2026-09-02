import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Loader2, Plus, Trash2, GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { courseLevelsApi } from '@/features/courses/courseLevelsApi';
import { departmentsApi } from '@/features/academics/departmentsApi';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';

const schema = z.object({
  value: z.coerce.number({ invalid_type_error: 'Enter a number.' })
    .int('Level must be a whole number.')
    .positive('Level must be positive.'),
  label: z.string().trim().max(50).optional(),
});

export const CourseLevelsPage = () => {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [selectedDepartment, setSelectedDepartment] = useState('');

  const departmentsQuery = useQuery({
    queryKey: ['departments', { scope: 'course-levels' }],
    queryFn: () => departmentsApi.list(),
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const listQueryKey = useMemo(
    () => ['course-levels', isSuperAdmin ? selectedDepartment || 'none' : 'self'],
    [isSuperAdmin, selectedDepartment],
  );

  const levelsQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () => courseLevelsApi.list(
      isSuperAdmin && selectedDepartment
        ? { departmentId: selectedDepartment }
        : undefined,
    ),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    enabled: !isSuperAdmin || !!selectedDepartment,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { value: '', label: '' },
  });

  const createMutation = useMutation({
    mutationFn: courseLevelsApi.create,
    onSuccess: () => {
      toast.success('Level added.');
      qc.invalidateQueries({ queryKey: listQueryKey });
      qc.invalidateQueries({ queryKey: ['course-levels', { scope: 'sidebar' }] });
      reset({ value: '', label: '' });
    },
    onError: (err) => toast.error(err.message || 'Failed to add level.'),
    onSettled: () => setSubmitting(false),
  });

  const removeMutation = useMutation({
    mutationFn: ({ id, params }) => courseLevelsApi.remove(id, params),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['course-levels'] });
      const previous = qc.getQueriesData({ queryKey: ['course-levels'] });
      qc.setQueriesData({ queryKey: ['course-levels'] }, (prev) => {
        if (!prev || !Array.isArray(prev.levels)) return prev;
        return { ...prev, levels: prev.levels.filter((l) => l.id !== id) };
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to remove level.');
    },
    onSuccess: () => {
      toast.success('Level removed.');
    },
  });

  const onSubmit = (values) => {
    if (isSuperAdmin && !selectedDepartment) {
      toast.error('Select a department before adding levels.');
      return;
    }
    if (placeholderMeta) {
      toast.error('Your account has no department linked. Contact the Examination Office to link your department before managing levels.');
      return;
    }
    setSubmitting(true);
    createMutation.mutate({
      value: values.value,
      label: values.label?.trim() ? values.label.trim() : undefined,
      ...(isSuperAdmin ? { departmentId: selectedDepartment || undefined } : {}),
    });
  };

  const levels = levelsQuery.data?.levels || [];
  const placeholderMeta = !isSuperAdmin && levelsQuery.data?.meta?.placeholder ? levelsQuery.data.meta : null;
  const requestedName = placeholderMeta?.requestedName || null;
  const departments = departmentsQuery.data || [];
  const disableForm = submitting || placeholderMeta || (isSuperAdmin && !selectedDepartment);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Course Levels"
        description="Configure the academic levels available for your department before adding courses."
        actions={user?.role === 'DEPARTMENT_HEAD' && user?.departmentName ? (
          <span className="rounded-full bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1">
            {user.departmentName}
          </span>
        ) : null}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)]">
        <form className="panel p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {isSuperAdmin && (
            <div className="grid gap-2">
              <label className="label">Department</label>
              <select
                className="input"
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  reset({ value: '', label: '' });
                }}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              {departmentsQuery.isLoading && (
                <p className="text-xs text-ink-400">Loading departments…</p>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-ink-900">Add a new level</h3>
            <p className="text-xs text-ink-500 mt-1">
              Typical levels are 100, 200, 300 and 400. You can add more if your department needs them.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Level value</label>
              <input
                className="input"
                type="number"
                placeholder="e.g. 500"
                {...register('value')}
              />
              {errors.value && <p className="field-error">{errors.value.message}</p>}
            </div>
            <div>
              <label className="label">Label (optional)</label>
              <input
                className="input"
                placeholder="e.g. Graduate"
                {...register('label')}
              />
              {errors.label && <p className="field-error">{errors.label.message}</p>}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={disableForm}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Add level</span>
          </button>
        </form>

        <div className="panel p-0">
          {isSuperAdmin && !selectedDepartment ? (
            <div className="p-8 text-sm text-ink-500">
              Select a department to view and manage its course levels.
            </div>
          ) : levelsQuery.isLoading ? (
            <SkeletonTable rows={4} cols={4} label="Loading course levels…" />
          ) : levels.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={GraduationCap}
                title="No levels yet"
                description="Add at least one level before registering courses."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Level</th>
                    <th className="text-left font-medium px-4 py-3">Label</th>
                    <th className="text-left font-medium px-4 py-3">Created</th>
                    <th className="text-right font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-divider">
                  {levels.map((level) => (
                    <tr key={level.id} className="hover:bg-surface-subtle/50">
                      <td className="px-4 py-3 font-medium text-ink-900">Level {level.value}</td>
                      <td className="px-4 py-3 text-ink-700">{level.label || '—'}</td>
                      <td className="px-4 py-3 text-ink-500">
                        {level.createdAt
                          ? new Date(level.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {level.readonly ? (
                          <span className="text-xs text-ink-400">Default</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                            disabled={removeMutation.isPending || placeholderMeta || (!level.departmentId && !isSuperAdmin)}
                            onClick={() => {
                              confirm({
                                title: 'Remove this level?',
                                description: `Level ${level.value} will be deleted. Courses already created with this level must be updated first.`,
                                confirmText: 'Remove level',
                                tone: 'danger',
                                onConfirm: () => removeMutation.mutate({
                                  id: level.id,
                                  params: isSuperAdmin ? { departmentId: selectedDepartment } : undefined,
                                }),
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {placeholderMeta && (
            <div className="border-t border-surface-border bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
              {requestedName
                ? `Default levels are shown because the “${requestedName}” department isn’t linked to your account. Contact the Examination Office to complete the setup.`
                : 'Default levels are shown because your account is not linked to any department. Contact the Examination Office to complete the setup.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
