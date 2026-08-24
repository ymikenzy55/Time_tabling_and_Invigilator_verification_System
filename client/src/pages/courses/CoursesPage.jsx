import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus, Loader2, Search, Pencil, Trash2, Send, CheckCircle2, BookOpen, CheckSquare, Square, Clock, AlertCircle, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { coursesApi } from '@/features/courses/coursesApi';
import { courseLevelsApi } from '@/features/courses/courseLevelsApi';
import { departmentsApi } from '@/features/academics/departmentsApi';
import { semestersApi } from '@/features/academics/semestersApi';
import { academicYearsApi } from '@/features/academics/academicYearsApi';
import { cn } from '@/lib/cn';

const ALLOWED_SEMESTER_NAMES = new Set(['first semester', 'second semester']);

const schema = z.object({
  code: z.string().trim().min(2, 'Course code is required.'),
  title: z.string().trim().min(2, 'Title is required.'),
  departmentId: z.string().optional(),
  semesterId: z.string().min(1, 'Semester is required.'),
  level: z.coerce.number().int().min(100, 'Select a level.').max(900),
  creditHours: z.coerce.number().int().min(1).max(20),
  studentCount: z.coerce.number().int().min(0).optional(),
  examDurationMinutes: z.coerce.number().int().min(15).max(300).optional(),
  specialRequirements: z.string().trim().max(500).optional(),
  instructorName: z.string().trim().min(2, 'Instructor name is required.').max(120),
});

const semesterSchema = z.object({
  academicYearId: z.string().min(1, 'Academic year is required.'),
  name: z.string().trim().min(1, 'Semester name is required.'),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  isActive: z.boolean().optional(),
}).refine((v) => new Date(v.endDate) > new Date(v.startDate), {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const statusBadge = {
  DRAFT: { variant: 'neutral', label: 'Not Sent' },
  SUBMITTED: { variant: 'warning', label: 'Pending' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REJECTED: { variant: 'danger', label: 'Rejected' },
};

export const CoursesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState(null);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  const isHead = user?.role === 'DEPARTMENT_HEAD';
  const isAdmin = user?.role === 'SUPER_ADMIN';

  const courseLevelsQuery = useQuery({
    queryKey: ['course-levels', 'course-form'],
    queryFn: () => courseLevelsApi.list(),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
  const courseLevels = courseLevelsQuery.data?.levels || [];
  const allowCreate = isHead && !!user?.departmentId;
  const notifyDepartmentMissing = () => toast.error(
    'Your account has no department linked. Contact the Examination Office to complete your setup.',
    { id: 'courses-department-missing' }
  );
  const coursesQueryKey = useMemo(() => ['courses', { scope: isAdmin ? 'approved' : 'all' }], [isAdmin]);

  const updateCoursesCache = (updater, { fallbackInvalidate = true } = {}) => {
    const existing = qc.getQueryData(coursesQueryKey);
    if (Array.isArray(existing)) {
      const next = updater(existing);
      qc.setQueryData(coursesQueryKey, next);
    } else if (fallbackInvalidate) {
      qc.invalidateQueries({ queryKey: ['courses'] });
    }
  };

  useEffect(() => {
    if (isAdmin) return;
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput, isAdmin]);

  const listQuery = useQuery({
    queryKey: ['courses', { scope: isAdmin ? 'approved' : 'all' }],
    queryFn: () => coursesApi.list(
      isAdmin ? { status: 'APPROVED' } : {}
    ),
    keepPreviousData: true,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: !isHead || !!user?.departmentId,
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: isAdmin,
  });

  const semestersQuery = useQuery({
    queryKey: ['semesters'],
    queryFn: () => semestersApi.list(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicYearsApi.list(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const activeAcademicYearId = useMemo(() => (
    academicYearsQuery.data || []
  ).find((year) => year.isActive)?.id ?? null, [academicYearsQuery.data]);

  const semesterOptions = useMemo(() => {
    const rows = semestersQuery.data || [];
    if (!isHead) return rows;

    const filtered = rows
      .filter((s) => ALLOWED_SEMESTER_NAMES.has(s.name?.trim().toLowerCase()))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (activeAcademicYearId) {
      const scoped = filtered.filter((s) => s.academicYearId === activeAcademicYearId);
      if (scoped.length > 0) return scoped;
    }

    return filtered;
  }, [semestersQuery.data, isHead, activeAcademicYearId]);

  const createMutation = useMutation({
    mutationFn: coursesApi.create,
    onSuccess: (course) => {
      closeModal();
      toast.success('Course created.');
      qc.setQueriesData({ queryKey: ['courses'] }, (prev) =>
        Array.isArray(prev) ? [course, ...prev] : prev
      );
    },
    onError: (err) => toast.error(err.message || 'Failed to create course.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => coursesApi.update(id, payload),
    onSuccess: (course) => {
      closeModal();
      toast.success('Course updated.');
      qc.setQueriesData({ queryKey: ['courses'] }, (prev) =>
        Array.isArray(prev) ? prev.map((c) => (c.id === course.id ? course : c)) : prev
      );
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
    onError: (err, _id, context) => {
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
      qc.setQueriesData({ queryKey: ['courses'] }, (prev) =>
        Array.isArray(prev) ? prev.map((c) => (c.id === course.id ? course : c)) : prev
      );
      toast.success(`${course.code} submitted for approval.`);
    },
    onError: (err) => toast.error(err.message || 'Failed to submit course.'),
  });

  const createSemesterMutation = useMutation({
    mutationFn: (values) => {
      if (editingSemester) {
        return semestersApi.update(editingSemester.id, values);
      }
      return semestersApi.create(values);
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['semesters'] });
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      toast.success(editingSemester ? 'Semester updated.' : 'Semester created.');
      setSemesterModalOpen(false);
      setEditingSemester(null);
      resetSem();
      if (created?.id && !editingSemester) {
        setValue('semesterId', created.id);
      }
    },
    onError: (err) => toast.error(err.message || 'Failed to save semester.'),
  });

  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', title: '', departmentId: user?.departmentId || '', semesterId: '',
      level: 100, creditHours: 3, studentCount: 0, examDurationMinutes: 120,
      specialRequirements: '', instructorName: '',
    },
  });

  const {
    register: registerSem, handleSubmit: handleSubmitSem, reset: resetSem,
    formState: { errors: semErrors },
  } = useForm({
    resolver: zodResolver(semesterSchema),
    defaultValues: { academicYearId: '', name: '', startDate: '', endDate: '', isActive: false },
  });

  useEffect(() => {
    if (!modalOpen) return;

    if (selected) {
      reset({
        code: selected.code,
        title: selected.title,
        departmentId: selected.departmentId,
        semesterId: selected.semesterId,
        level: selected.level,
        creditHours: selected.creditHours,
        studentCount: selected.studentCount,
        examDurationMinutes: selected.examDurationMinutes,
        specialRequirements: selected.specialRequirements || '',
        instructorName: selected.instructorName || '',
      });
    } else {
      reset({
        code: '',
        title: '',
        departmentId: user?.departmentId || '',
        semesterId: '',
        level: 100,
        creditHours: 3,
        studentCount: 0,
        examDurationMinutes: 120,
        specialRequirements: '',
        instructorName: '',
      });
    }

  }, [modalOpen, selected, reset, user?.departmentId, setValue]);

  const openCreate = () => {
    if (!allowCreate) {
      notifyDepartmentMissing();
      return;
    }
    setSelected(null);
    setModalOpen(true);
  };
  const openEdit = (course) => { setSelected(course); setModalOpen(true); };
  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
  };

  const onSubmit = (values) => {
    if (!allowCreate) {
      notifyDepartmentMissing();
      return;
    }
    const payload = { ...values };
    if (selected) {
      updateMutation.mutate({ id: selected.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const onSubmitSemester = async (values) => {
    try {
      await createSemesterMutation.mutateAsync(values);
    } catch {
      // Error is already toasted by the mutation's onError.
    }
  };

  const allCourses = listQuery.data || [];
  const courses = useMemo(() => {
    let result = allCourses;
    const q = searchInput.trim().toLowerCase();
    if (q) {
      result = result.filter((c) =>
        (c.code || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.instructorName || '').toLowerCase().includes(q)
      );
    }
    if (filterDept) {
      result = result.filter((c) => c.departmentId === filterDept);
    }
    if (filterLevel) {
      result = result.filter((c) => String(c.level) === String(filterLevel));
    }
    if (filterSemester) {
      result = result.filter((c) => c.semesterId === filterSemester);
    }
    return result;
  }, [allCourses, searchInput, filterDept, filterLevel, filterSemester]);
  let listError = listQuery.isError ? (listQuery.error?.message || 'Failed to load courses.') : null;
  const cannotManageCourses = isHead && !user?.departmentId;
  if (cannotManageCourses) {
    listError = null;
  }
  const isLoading = listQuery.isLoading;
  const isSubmitting = createMutation.isPending || updateMutation.isPending || createSemesterMutation.isPending;

  const canEdit = (course) =>
    (isAdmin || (isHead && course.createdById === user?.id)) && !course.locked && course.status !== 'APPROVED';

  const canSubmit = (course) =>
    (isAdmin || (isHead && course.createdById === user?.id)) &&
    course.status === 'DRAFT';

  const canDelete = (course) =>
    (isAdmin || (isHead && course.createdById === user?.id)) &&
    !course.locked && course.status !== 'APPROVED';

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

  const handleSubmitAll = () => {
    if (selectedDrafts.length === 0) {
      if (submittedCourses.length > 0) {
        toast(`${submittedCourses.length} course${submittedCourses.length === 1 ? '' : 's'} already submitted. Select draft courses to submit.`, {
          icon: 'ℹ️',
        });
      } else {
        toast('Select at least one draft course to submit.', { icon: 'ℹ️' });
      }
      return;
    }
    setSubmitModalOpen(true);
  };

  const confirmSubmit = () => {
    selectedDrafts.forEach((c) => submitMutation.mutate(c.id));
    setSelectedIds(new Set());
    setSubmitModalOpen(false);
  };

  const openEditSemester = (sem) => {
    setEditingSemester(sem);
    resetSem({
      academicYearId: sem.academicYearId || '',
      name: sem.name || '',
      startDate: sem.startDate ? sem.startDate.split('T')[0] : '',
      endDate: sem.endDate ? sem.endDate.split('T')[0] : '',
      isActive: sem.isActive || false,
    });
    setSemesterModalOpen(true);
  };

  const openCreateSemester = () => {
    setEditingSemester(null);
    resetSem({ academicYearId: '', name: '', startDate: '', endDate: '', isActive: false });
    setSemesterModalOpen(true);
  };

  const formatExamDuration = (minutes) => {
    if (!minutes) return '—';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}min`;
    if (mins === 0) return `${hrs}hr`;
    return `${hrs}hr ${mins}min`;
  };

  return (
    <>
      <PageHeader
        title="Courses"
        description={isHead ? 'Manage your department courses.' : 'Manage all courses across departments.'}
        actions={(
          <div className="flex items-center gap-2">
            {isHead && user?.departmentName ? (
              <span className="rounded-full bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1">
                {user.departmentName}
              </span>
            ) : null}
            {selectedDrafts.length > 0 && (
              <button
                className="btn-primary"
                onClick={handleSubmitAll}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit for approval{selectedDrafts.length > 1 ? ` (${selectedDrafts.length})` : ''}
              </button>
            )}
            {allowCreate ? (
              <button className="btn-secondary" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Add New Course
              </button>
            ) : null}
          </div>
        )}
      />

      {cannotManageCourses && (
        <div className="panel border-amber-200 bg-amber-50 text-amber-900 mb-4 p-4 text-sm">
          Your account is not linked to a department. Contact the Examination Office to enable course management.
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search courses..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {isAdmin && (
            <select
              className="input max-w-[180px]"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">All departments</option>
              {(departmentsQuery.data || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <select
            className="input max-w-[140px]"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <option value="">All levels</option>
            {Array.from(new Set(allCourses.map((c) => c.level).filter(Boolean))).sort((a, b) => a - b).map((lvl) => (
              <option key={lvl} value={lvl}>Level {lvl}</option>
            ))}
          </select>
          <select
            className="input max-w-[180px]"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
          >
            <option value="">All semesters</option>
            {(isHead ? semesterOptions : (semestersQuery.data || [])).map((s) => (
              <option key={s.id} value={s.id}>{s.name} {s.academicYear?.name || ''}</option>
            ))}
          </select>
          {(filterDept || filterLevel || filterSemester) && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => { setFilterDept(''); setFilterLevel(''); setFilterSemester(''); }}
            >
              Clear filters
            </button>
          )}
        </div>

        {listError ? (
          <div className="p-10 text-sm text-rose-600">
            {listError}
          </div>
        ) : isLoading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : courses.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description={allowCreate ? 'Create a course to start planning examinations.' : 'Courses will appear here once your department is linked and ready.'}
              action={allowCreate ? (
                <button className="btn-primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Add New Course
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
                  <th className="text-left font-medium px-4 py-3">Department</th>
                  <th className="text-left font-medium px-4 py-3">Semester</th>
                  <th className="text-left font-medium px-4 py-3">Instructor</th>
                  <th className="text-left font-medium px-4 py-3">Level</th>
                  <th className="text-left font-medium px-4 py-3">Exam Duration</th>
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
                      <td className="px-4 py-3 font-medium text-ink-900">{course.code}</td>
                      <td className="px-4 py-3 text-ink-700">{course.title}</td>
                      <td className="px-4 py-3 text-ink-700">{course.department?.name || '—'}</td>
                      <td className="px-4 py-3 text-ink-700">{course.semester?.name || '—'}</td>
                      <td className="px-4 py-3 text-ink-700">{course.instructorName || '—'}</td>
                      <td className="px-4 py-3 text-ink-700">{course.level}</td>
                      <td className="px-4 py-3 text-ink-700">{formatExamDuration(course.examDurationMinutes)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={variant}>{label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canEdit(course) && (
                            <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={() => openEdit(course)}>
                              <Pencil className="w-4 h-4" /> Edit
                            </button>
                          )}
                          {canDelete(course) && (
                            <button
                              className="btn btn-sm w-full sm:w-auto text-rose-700 border border-rose-200 hover:bg-rose-50"
                              onClick={() => {
                                confirm({
                                  title: 'Delete this course?',
                                  description: `"${course.code} — ${course.title}" will be permanently removed. This action cannot be undone.`,
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={selected ? 'Edit Course' : 'Add New Course'}
        description={selected ? 'Update course details.' : 'Create a new course.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Code</label>
              <input className="input" {...register('code')} />
              {errors.code && <p className="field-error">{errors.code.message}</p>}
            </div>
            <div>
              <label className="label">Level</label>
              <select className="input" {...register('level')}>
                <option value="" disabled>Select level</option>
                {courseLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.value}>
                    {lvl.label || `Level ${lvl.value}`}
                  </option>
                ))}
              </select>
              {errors.level && <p className="field-error">{errors.level.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" {...register('title')} />
            {errors.title && <p className="field-error">{errors.title.message}</p>}
          </div>
          <div className={cn('grid gap-3', isHead ? 'grid-cols-1' : 'grid-cols-2')}>
            {!isHead && (
              <div>
                <label className="label">Department</label>
                <select className="input" {...register('departmentId')}>
                  <option value="">Select department</option>
                  {(departmentsQuery.data || []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {errors.departmentId && <p className="field-error">{errors.departmentId.message}</p>}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Semester</label>
                <div className="flex items-center gap-2 mb-1">
                  {semesterOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openEditSemester(semesterOptions.find((s) => s.id === watch('semesterId')))}
                      className="text-xs text-ink-500 hover:text-primary-700 font-medium"
                    >
                      Edit semester
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openCreateSemester}
                    className="text-xs text-primary-700 hover:text-primary-800 font-medium"
                  >
                    + New semester
                  </button>
                </div>
              </div>
              <select className="input" {...register('semesterId')}>
                <option value="">Select semester</option>
                {semesterOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.semesterId && <p className="field-error">{errors.semesterId.message}</p>}
              {isHead && semesterOptions.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Contact the Examination Office to activate the current academic year before assigning courses.
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="label">Instructor</label>
            <input className="input" {...register('instructorName')} />
            {errors.instructorName && <p className="field-error">{errors.instructorName.message}</p>}
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
              {errors.studentCount && <p className="field-error">{errors.studentCount.message}</p>}
            </div>
            <div>
              <label className="label">Exam duration</label>
              <div className="flex gap-2">
                <input
                  className="input w-20"
                  type="number"
                  min="0"
                  max="5"
                  placeholder="hrs"
                  value={Math.floor((watch('examDurationMinutes') || 0) / 60)}
                  onChange={(e) => {
                    const hrs = Number(e.target.value) || 0;
                    const mins = (watch('examDurationMinutes') || 0) % 60;
                    setValue('examDurationMinutes', hrs * 60 + mins);
                  }}
                />
                <span className="self-center text-sm text-ink-500">hr</span>
                <input
                  className="input w-20"
                  type="number"
                  min="0"
                  max="59"
                  step="5"
                  placeholder="min"
                  value={(watch('examDurationMinutes') || 0) % 60}
                  onChange={(e) => {
                    const mins = Number(e.target.value) || 0;
                    const hrs = Math.floor((watch('examDurationMinutes') || 0) / 60);
                    setValue('examDurationMinutes', hrs * 60 + mins);
                  }}
                />
                <span className="self-center text-sm text-ink-500">min</span>
              </div>
              {errors.examDurationMinutes && <p className="field-error">{errors.examDurationMinutes.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Special requirements</label>
            <textarea className="input min-h-[80px]" {...register('specialRequirements')} />
            {errors.specialRequirements && <p className="field-error">{errors.specialRequirements.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !allowCreate}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {selected ? 'Save changes' : 'Create course'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={semesterModalOpen}
        onClose={() => { setSemesterModalOpen(false); setEditingSemester(null); resetSem(); }}
        title={editingSemester ? 'Edit semester' : 'New semester'}
        description={editingSemester ? 'Update semester details.' : 'Create a semester so it can be selected for this course.'}
      >
        <form onSubmit={handleSubmitSem(onSubmitSemester)} className="space-y-4">
          <div>
            <label className="label">Academic year</label>
            <select className="input" {...registerSem('academicYearId')}>
              <option value="">Select academic year</option>
              {(academicYearsQuery.data || []).map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
            {semErrors.academicYearId && <p className="field-error">{semErrors.academicYearId.message}</p>}
          </div>
          <div>
            <label className="label">Semester name</label>
            <input className="input" placeholder="e.g. First Semester" {...registerSem('name')} />
            {semErrors.name && <p className="field-error">{semErrors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input type="date" className="input" {...registerSem('startDate')} />
              {semErrors.startDate && <p className="field-error">{semErrors.startDate.message}</p>}
            </div>
            <div>
              <label className="label">End date</label>
              <input type="date" className="input" {...registerSem('endDate')} />
              {semErrors.endDate && <p className="field-error">{semErrors.endDate.message}</p>}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" {...registerSem('isActive')} />
            Set as active semester
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setSemesterModalOpen(false); setEditingSemester(null); resetSem(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createSemesterMutation.isPending}>
              {createSemesterMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingSemester ? 'Save changes' : 'Create semester'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title="Submit courses for approval"
        description="The following courses will be sent to the Examination Office for review. You won't be able to edit them after submission."
        size="md"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900">
              Once submitted, these courses cannot be edited until they are approved or rejected by the Examination Office.
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-surface-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-ink-500 text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Code</th>
                  <th className="text-left font-medium px-3 py-2">Title</th>
                  <th className="text-left font-medium px-3 py-2">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-divider">
                {selectedDrafts.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-medium text-ink-900">{c.code}</td>
                    <td className="px-3 py-2 text-ink-700">{c.title}</td>
                    <td className="px-3 py-2 text-ink-700">{c.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-500">
            <span className="font-bold text-ink-900">{selectedDrafts.length}</span> course{selectedDrafts.length === 1 ? '' : 's'} will be submitted.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setSubmitModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              onClick={confirmSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Confirm & submit
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
