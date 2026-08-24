import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus, Loader2, Pencil, Trash2, Send, GraduationCap, ArrowLeft, CheckSquare, Square,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { coursesApi } from '@/features/courses/coursesApi';
import { semestersApi } from '@/features/academics/semestersApi';
import { cn } from '@/lib/cn';

const schema = z.object({
  code: z.string().trim().min(2, 'Course code is required.'),
  title: z.string().trim().min(2, 'Title is required.'),
  creditHours: z.coerce.number().int().min(1).max(20),
  studentCount: z.coerce.number().int().min(0).optional(),
  examDurationMinutes: z.coerce.number().int().min(15).max(300).optional(),
  specialRequirements: z.string().trim().max(500).optional(),
  instructorName: z.string().trim().min(2, 'Instructor name is required.').max(120),
  isPractical: z.boolean().default(false),
});

const statusBadge = {
  DRAFT: { variant: 'neutral', label: 'Draft' },
  SUBMITTED: { variant: 'warning', label: 'Submitted' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REJECTED: { variant: 'danger', label: 'Rejected' },
};

export const CoursesByLevelPage = () => {
  const { semester: semesterParam, level: levelParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const level = Number(levelParam);
  const isHead = user?.role === 'DEPARTMENT_HEAD';
  const allowCreate = isHead && !!user?.departmentId;

  const semesterSlug = semesterParam;
  const semesterLabel = semesterSlug === 'first' ? 'First Semester' : semesterSlug === 'second' ? 'Second Semester' : 'Semester';

  const semestersQuery = useQuery({
    queryKey: ['semesters'],
    queryFn: () => semestersApi.list(),
    staleTime: 5 * 60_000,
  });

  const activeSemester = useMemo(() => {
    return (semestersQuery.data || []).find((s) => {
      const name = s.name.trim().toLowerCase();
      if (semesterSlug === 'first') return name.includes('first');
      if (semesterSlug === 'second') return name.includes('second');
      return false;
    });
  }, [semestersQuery.data, semesterSlug]);

  const coursesQuery = useQuery({
    queryKey: ['courses', 'by-level', user?.departmentId, level, activeSemester?.id],
    queryFn: () => coursesApi.list({
      departmentId: user?.departmentId,
      level,
      semesterId: activeSemester?.id,
    }),
    enabled: !!user?.departmentId && Number.isInteger(level) && !!activeSemester?.id,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', title: '',
      creditHours: 3, studentCount: 0, examDurationMinutes: 120,
      specialRequirements: '', instructorName: '', isPractical: false,
    },
  });

  useEffect(() => {
    if (modalOpen) {
      if (selected) {
        reset({
          code: selected.code,
          title: selected.title,
          creditHours: selected.creditHours,
          studentCount: selected.studentCount ?? 0,
          examDurationMinutes: selected.examDurationMinutes ?? 120,
          specialRequirements: selected.specialRequirements || '',
          instructorName: selected.instructorName || '',
          isPractical: selected.isPractical ?? false,
        });
      } else {
        reset({
          code: '', title: '',
          creditHours: 3, studentCount: 0, examDurationMinutes: 120,
          specialRequirements: '', instructorName: '', isPractical: false,
        });
      }
    }
  }, [modalOpen, selected, reset]);

  const updateCache = (updater) => {
    const keys = [
      ['courses', 'by-level', user?.departmentId, level, activeSemester?.id],
      ['courses'],
    ];
    keys.forEach((key) => {
      const existing = qc.getQueryData(key);
      if (Array.isArray(existing)) {
        qc.setQueryData(key, updater(existing));
      } else {
        qc.invalidateQueries({ queryKey: key });
      }
    });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => coursesApi.create({
      ...payload,
      level,
      departmentId: user?.departmentId,
    }),
    onMutate: () => {
      setModalOpen(false);
      toast.success('Course created.');
    },
    onSuccess: (course) => {
      updateCache((prev) => [course, ...prev]);
    },
    onError: (err) => toast.error(err.message || 'Failed to create course.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => coursesApi.update(id, payload),
    onMutate: () => {
      setModalOpen(false);
      toast.success('Course updated.');
    },
    onSuccess: (course) => {
      updateCache((prev) => prev.map((c) => (c.id === course.id ? course : c)));
    },
    onError: (err) => toast.error(err.message || 'Failed to update course.'),
  });

  const removeMutation = useMutation({
    mutationFn: coursesApi.remove,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['courses'] });
      const previous = qc.getQueriesData({ queryKey: ['courses'] });
      qc.setQueriesData({ queryKey: ['courses'] }, (prev) =>
        Array.isArray(prev) ? prev.filter((c) => c.id !== id) : prev
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to delete course.');
    },
    onSuccess: () => {
      toast.success('Course deleted.');
    },
  });

  const submitMutation = useMutation({
    mutationFn: coursesApi.submit,
    onSuccess: (course) => {
      updateCache((prev) => prev.map((c) => (c.id === course.id ? course : c)));
      toast.success(`${course.code} submitted for approval.`);
    },
    onError: (err) => toast.error(err.message || 'Failed to submit course.'),
  });

  const courses = coursesQuery.data || [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const canEdit = (course) =>
    (isHead && course.createdById === user?.id) && !course.locked && course.status !== 'APPROVED';

  const canSubmit = (course) =>
    (isHead && course.createdById === user?.id) && course.status === 'DRAFT';

  const canDelete = (course) =>
    (isHead && course.createdById === user?.id) && !course.locked && course.status !== 'APPROVED';

  const draftCourses = courses.filter((c) => canSubmit(c));
  const submittedCourses = courses.filter((c) => c.status === 'SUBMITTED');

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (draftCourses.length > 0 && draftCourses.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(draftCourses.map((c) => c.id)));
    }
  };

  const allDraftSelected = draftCourses.length > 0 && draftCourses.every((c) => selectedIds.has(c.id));
  const selectedDrafts = draftCourses.filter((c) => selectedIds.has(c.id));

  const handleSubmitAll = async () => {
    if (selectedDrafts.length === 0) {
      const anySubmitted = submittedCourses.length > 0;
      if (anySubmitted) {
        toast(`${submittedCourses.length} course${submittedCourses.length === 1 ? '' : 's'} already submitted. Select draft courses to submit.`, {
          icon: 'ℹ️',
        });
      } else {
        toast('Select at least one draft course to submit.', { icon: 'ℹ️' });
      }
      return;
    }
    const ok = await confirm({
      title: 'Submit courses for approval?',
      description: `${selectedDrafts.length} course${selectedDrafts.length === 1 ? '' : 's'} will be submitted to the Examination Office for review. You won't be able to edit them until they are approved or rejected.`,
      confirmText: 'Submit',
      tone: 'primary',
    });
    if (!ok) return;
    selectedDrafts.forEach((c) => submitMutation.mutate(c.id));
    setSelectedIds(new Set());
  };

  const onSubmit = (values) => {
    const payload = { ...values, semesterId: activeSemester?.id };
    if (selected) {
      updateMutation.mutate({ id: selected.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = (course) => { setSelected(course); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setSelected(null); };

  return (
    <>
      <PageHeader
        title={`${semesterLabel} \u2014 Level ${level}`}
        description={`Manage courses for Level ${level} in ${semesterLabel.toLowerCase()}.`}
        actions={(
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => navigate('/courses')}>
              <ArrowLeft className="w-4 h-4" /> All Courses
            </button>
            {selectedDrafts.length > 0 && (
              <button
                className="btn-primary"
                onClick={handleSubmitAll}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit{selectedDrafts.length > 1 ? ` (${selectedDrafts.length})` : ''}
              </button>
            )}
            {allowCreate && (
              <button className="btn-secondary" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Add course
              </button>
            )}
          </div>
        )}
      />

      {!activeSemester && !semestersQuery.isLoading ? (
        <div className="panel p-8">
          <EmptyState
            icon={GraduationCap}
            title={`${semesterLabel} not available`}
            description="Contact the Examination Office to ensure this semester is created and active."
          />
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {coursesQuery.isLoading ? (
            <div className="p-10 grid place-items-center text-ink-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={GraduationCap}
                title={`No courses for Level ${level}`}
                description={allowCreate ? `Add a course for Level ${level} in ${semesterLabel.toLowerCase()} to get started.` : 'Courses will appear here once your department is linked.'}
                action={allowCreate ? (
                  <button className="btn-primary" onClick={openCreate}>
                    <Plus className="w-4 h-4" /> Add course
                  </button>
                ) : null}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                  <tr>
                    {isHead && draftCourses.length > 0 && (
                      <th className="text-left font-medium px-4 py-3 w-10">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-ink-600 hover:text-primary-600"
                          aria-label={allDraftSelected ? 'Deselect all' : 'Select all drafts'}
                        >
                          {allDraftSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                    )}
                    <th className="text-left font-medium px-4 py-3">Code</th>
                    <th className="text-left font-medium px-4 py-3">Title</th>
                    <th className="text-left font-medium px-4 py-3">Semester</th>
                    <th className="text-left font-medium px-4 py-3">Instructor</th>
                    <th className="text-left font-medium px-4 py-3">Status</th>
                    <th className="text-right font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-divider">
                  {courses.map((course) => {
                    const { variant, label } = statusBadge[course.status];
                    const isSelectable = canSubmit(course);
                    const isSelected = selectedIds.has(course.id);
                    return (
                      <tr key={course.id} className={cn('hover:bg-surface-subtle/50', isSelected && 'bg-primary-50/40')}>
                        {isHead && draftCourses.length > 0 && (
                          <td className="px-4 py-3">
                            {isSelectable && (
                              <button
                                type="button"
                                onClick={() => toggleSelect(course.id)}
                                className="text-ink-600 hover:text-primary-600"
                                aria-label={isSelected ? 'Deselect' : 'Select'}
                              >
                                {isSelected ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-ink-900">
                          <div className="flex items-center gap-1.5">
                            {course.code}
                            {course.isPractical && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                Practical
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{course.title}</td>
                        <td className="px-4 py-3 text-ink-500">{course.semester?.name || '—'}</td>
                        <td className="px-4 py-3 text-ink-700">{course.instructorName || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={variant}>{label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {canEdit(course) && (
                              <button className="btn-secondary btn-sm" onClick={() => openEdit(course)}>
                                <Pencil className="w-4 h-4" /> Edit
                              </button>
                            )}
                            {canDelete(course) && (
                              <button
                                className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                                onClick={() => {
                                  confirm({
                                    title: 'Delete this course?',
                                    description: `"${course.code} — ${course.title}" will be permanently removed.`,
                                    confirmText: 'Delete',
                                    tone: 'danger',
                                    onConfirm: () => removeMutation.mutate(course.id),
                                  });
                                }}
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="lg"
        title={selected ? 'Edit course' : `Add course — ${semesterLabel}, Level ${level}`}
        description={selected ? 'Update course details.' : `Create a new course for ${semesterLabel.toLowerCase()}, Level ${level}.`}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Code</label>
              <input className="input" {...register('code')} />
              {errors.code && <p className="field-error">{errors.code.message}</p>}
            </div>
            <div>
              <label className="label">Level</label>
              <input className="input bg-surface-subtle" value={`Level ${level}`} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Title</label>
              <input className="input" {...register('title')} />
              {errors.title && <p className="field-error">{errors.title.message}</p>}
            </div>
            <div>
              <label className="label">Instructor</label>
              <input className="input" {...register('instructorName')} />
              {errors.instructorName && <p className="field-error">{errors.instructorName.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Semester</label>
            <input className="input bg-surface-subtle" value={semesterLabel} disabled />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Credit hours</label>
              <input className="input" type="number" {...register('creditHours')} />
              {errors.creditHours && <p className="field-error">{errors.creditHours.message}</p>}
            </div>
            <div>
              <label className="label">Students</label>
              <input className="input" type="number" {...register('studentCount')} />
            </div>
            <div>
              <label className="label">Exam duration (min)</label>
              <input className="input" type="number" {...register('examDurationMinutes')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-start">
            <div>
              <label className="label">Special requirements</label>
              <textarea className="input min-h-[44px]" {...register('specialRequirements')} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none mt-7">
              <input
                type="checkbox"
                {...register('isPractical')}
                className="w-4 h-4 rounded border-surface-border text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-ink-700">This is a practical course</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {selected ? 'Save changes' : 'Create course'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
