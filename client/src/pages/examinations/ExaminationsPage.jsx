import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus, Loader2, Search, Pencil, Trash2, Calendar, Eye, ClipboardList, QrCode,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { examinationSessionsApi } from '@/features/examinations/examinationSessionsApi';
import { invigilationsApi } from '@/features/examinations/invigilationsApi';
import { semestersApi } from '@/features/academics/semestersApi';
import { coursesApi } from '@/features/courses/coursesApi';
import { usersApi } from '@/features/users/usersApi';
import { cn } from '@/lib/cn';

const sessionSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  semesterId: z.string().min(1, 'Semester is required.'),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  isPublished: z.coerce.boolean().optional(),
}).refine((v) => new Date(v.endDate) > new Date(v.startDate), {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const invigilationSchema = z.object({
  courseId: z.string().min(1, 'Course is required.'),
  invigilatorId: z.string().min(1, 'Invigilator is required.'),
  scheduledAt: z.string().min(1, 'Scheduled time is required.'),
  windowOpensAt: z.string().optional(),
  windowClosesAt: z.string().optional(),
  gracePeriodMin: z.coerce.number().int().min(0).default(0),
}).refine((v) => !v.windowOpensAt || !v.windowClosesAt || new Date(v.windowClosesAt) > new Date(v.windowOpensAt), {
  message: 'Window close time must be after open time.',
  path: ['windowClosesAt'],
});

const formatDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? v : d.toISOString().split('T')[0];
};

const formatForInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? v : d.toISOString().slice(0, 16);
};

export const ExaminationsPage = () => {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionModal, setSessionModal] = useState({ open: false, session: null });
  const [invigilationModal, setInvigilationModal] = useState({ open: false, invigilation: null });
  const [replaceModal, setReplaceModal] = useState({ open: false, invigilation: null, replacementId: '' });

  const sessionsQuery = useQuery({
    queryKey: ['examinationSessions', { q: search }],
    queryFn: () => examinationSessionsApi.list({ q: search }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const semestersQuery = useQuery({
    queryKey: ['semesters'],
    queryFn: () => semestersApi.list(),
    staleTime: 5 * 60_000,
  });

  const invigilationsQuery = useQuery({
    queryKey: ['invigilations', { examinationSessionId: selectedSession?.id }],
    queryFn: () => invigilationsApi.list({ examinationSessionId: selectedSession.id }),
    enabled: !!selectedSession,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const coursesQuery = useQuery({
    queryKey: ['courses', 'approved'],
    queryFn: () => coursesApi.list({ status: 'APPROVED' }),
    staleTime: 60_000,
  });

  const invigilatorsQuery = useQuery({
    queryKey: ['users', { role: 'INVIGILATOR' }],
    queryFn: () => usersApi.list({ role: 'INVIGILATOR' }),
    staleTime: 60_000,
  });

  const createSession = useMutation({
    mutationFn: examinationSessionsApi.create,
    onSuccess: () => { toast.success('Session created.'); qc.invalidateQueries({ queryKey: ['examinationSessions'] }); closeSessionModal(); },
    onError: (err) => toast.error(err.message || 'Failed to create session.'),
  });

  const updateSession = useMutation({
    mutationFn: ({ id, payload }) => examinationSessionsApi.update(id, payload),
    onSuccess: () => { toast.success('Session updated.'); qc.invalidateQueries({ queryKey: ['examinationSessions'] }); closeSessionModal(); },
    onError: (err) => toast.error(err.message || 'Failed to update session.'),
  });

  const removeSession = useMutation({
    mutationFn: examinationSessionsApi.remove,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['examinationSessions'] });
      const previous = qc.getQueriesData({ queryKey: ['examinationSessions'] });
      qc.setQueriesData({ queryKey: ['examinationSessions'] }, (prev) =>
        Array.isArray(prev) ? prev.filter((s) => s.id !== id) : prev
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to delete session.');
    },
    onSuccess: () => { toast.success('Session deleted.'); setSelectedSession(null); },
  });

  const createInvigilation = useMutation({
    mutationFn: invigilationsApi.create,
    onSuccess: () => { toast.success('Invigilation assigned.'); qc.invalidateQueries({ queryKey: ['invigilations'] }); qc.invalidateQueries({ queryKey: ['examinationSessions'] }); closeInvigilationModal(); },
    onError: (err) => toast.error(err.message || 'Failed to assign invigilation.'),
  });

  const updateInvigilation = useMutation({
    mutationFn: ({ id, payload }) => invigilationsApi.update(id, payload),
    onSuccess: () => { toast.success('Invigilation updated.'); qc.invalidateQueries({ queryKey: ['invigilations'] }); closeInvigilationModal(); },
    onError: (err) => toast.error(err.message || 'Failed to update invigilation.'),
  });

  const removeInvigilation = useMutation({
    mutationFn: invigilationsApi.remove,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['invigilations'] });
      const previous = qc.getQueriesData({ queryKey: ['invigilations'] });
      qc.setQueriesData({ queryKey: ['invigilations'] }, (prev) =>
        Array.isArray(prev) ? prev.filter((i) => i.id !== id) : prev
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to remove invigilation.');
    },
    onSuccess: () => { toast.success('Invigilation removed.'); },
  });

  const replaceInvigilation = useMutation({
    mutationFn: ({ id, replacementId }) => invigilationsApi.replace(id, { replacementId }),
    onSuccess: () => {
      toast.success('Invigilator replaced.');
      qc.invalidateQueries({ queryKey: ['invigilations'] });
      qc.invalidateQueries({ queryKey: ['examinationSessions'] });
      setReplaceModal({ open: false, invigilation: null, replacementId: '' });
    },
    onError: (err) => toast.error(err.message || 'Failed to replace invigilator.'),
  });

  const sessionForm = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: { name: '', semesterId: '', startDate: '', endDate: '', isPublished: false },
  });

  const invigilationForm = useForm({
    resolver: zodResolver(invigilationSchema),
    defaultValues: { courseId: '', invigilatorId: '', scheduledAt: '', windowOpensAt: '', windowClosesAt: '', gracePeriodMin: 0 },
  });

  useEffect(() => {
    if (sessionModal.open && sessionModal.session) {
      sessionForm.reset({
        name: sessionModal.session.name,
        semesterId: sessionModal.session.semester?.id || '',
        startDate: formatDate(sessionModal.session.startDate),
        endDate: formatDate(sessionModal.session.endDate),
        isPublished: sessionModal.session.isPublished,
      });
    } else if (sessionModal.open) {
      sessionForm.reset({ name: '', semesterId: '', startDate: '', endDate: '', isPublished: false });
    }
  }, [sessionModal.open, sessionModal.session, sessionForm]);

  useEffect(() => {
    if (invigilationModal.open && invigilationModal.invigilation) {
      invigilationForm.reset({
        courseId: invigilationModal.invigilation.course?.id || '',
        invigilatorId: invigilationModal.invigilation.invigilator?.id || '',
        scheduledAt: formatForInput(invigilationModal.invigilation.scheduledAt),
        windowOpensAt: formatForInput(invigilationModal.invigilation.windowOpensAt) || '',
        windowClosesAt: formatForInput(invigilationModal.invigilation.windowClosesAt) || '',
        gracePeriodMin: invigilationModal.invigilation.gracePeriodMin || 0,
      });
    } else if (invigilationModal.open) {
      invigilationForm.reset({ courseId: '', invigilatorId: '', scheduledAt: '', windowOpensAt: '', windowClosesAt: '', gracePeriodMin: 0 });
    }
  }, [invigilationModal.open, invigilationModal.invigilation, invigilationForm]);

  const openSessionCreate = () => setSessionModal({ open: true, session: null });
  const openSessionEdit = (session) => setSessionModal({ open: true, session });
  const closeSessionModal = () => setSessionModal({ open: false, session: null });

  const openInvigilationCreate = () => setInvigilationModal({ open: true, invigilation: null });
  const openInvigilationEdit = (invigilation) => setInvigilationModal({ open: true, invigilation });
  const closeInvigilationModal = () => setInvigilationModal({ open: false, invigilation: null });

  const sessions = sessionsQuery.data || [];
  const invigilations = invigilationsQuery.data || [];
  const isLoading = sessionsQuery.isLoading || semestersQuery.isLoading;

  return (
    <>
      <PageHeader
        title="Examination Sessions"
        description="Create exam sessions and manage invigilator assignments."
        actions={
          <button className="btn-primary" onClick={openSessionCreate}>
            <Plus className="w-4 h-4" /> Create Exam Session
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search sessions..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} lines={2} />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Calendar} title="No sessions yet" description="Create an exam session to get started." />
            </div>
          ) : (
            <div className="divide-y divide-surface-divider max-h-[600px] overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-surface-subtle transition-colors',
                    selectedSession?.id === s.id && 'bg-primary-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-ink-900">{s.name}</div>
                    {s.isPublished ? <Badge variant="success">Published</Badge> : <Badge variant="neutral">Draft</Badge>}
                  </div>
                  <div className="text-xs text-ink-500 mt-1">
                    {s.semester?.academicYear?.name} — {s.semester?.name}
                  </div>
                  <div className="text-xs text-ink-500">
                    {formatDate(s.startDate)} → {formatDate(s.endDate)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 card overflow-hidden">
          {selectedSession ? (
            <>
              <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-ink-900">{selectedSession.name}</div>
                  <div className="text-xs text-ink-500">
                    {selectedSession.semester?.academicYear?.name} — {selectedSession.semester?.name} • {formatDate(selectedSession.startDate)} → {formatDate(selectedSession.endDate)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => openSessionEdit(selectedSession)}>
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                    onClick={() => {
                      confirm({
                        title: 'Delete this examination session?',
                        description: 'All invigilator assignments under this session will be removed. This action cannot be undone.',
                        confirmText: 'Delete session',
                        tone: 'danger',
                        onConfirm: () => removeSession.mutate(selectedSession.id),
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>

              <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                <div className="text-sm font-medium text-ink-700">Invigilations</div>
                <Link className="btn-primary btn-sm" to="/invigilator-assignments">
                  <ClipboardList className="w-4 h-4" /> Manage Invigilators
                </Link>
              </div>

              {invigilationsQuery.isLoading ? (
                <div className="p-4">
                  <SkeletonTable rows={4} cols={4} />
                </div>
              ) : invigilations.length === 0 ? (
                <div className="p-10">
                  <EmptyState icon={ClipboardList} title="No invigilations yet" description="Use the Invigilator Assignments page to assign invigilators to courses in this session." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Course</th>
                        <th className="text-left font-medium px-4 py-3">Invigilator</th>
                        <th className="text-left font-medium px-4 py-3">Scheduled</th>
                        <th className="text-right font-medium px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-divider">
                      {invigilations.map((i) => (
                        <tr key={i.id} className="hover:bg-surface-subtle/50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink-900">{i.course?.code}</div>
                            <div className="text-xs text-ink-500">{i.course?.title}</div>
                          </td>
                          <td className="px-4 py-3 text-ink-700">
                            {i.invigilator ? (
                              <div>
                                <div>{i.invigilator.fullName}</div>
                                {i.replacement && (
                                  <div className="text-xs text-amber-600 mt-0.5">
                                    Replaced by {i.replacement.fullName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-ink-500 italic">Unassigned</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-700">{formatDateTime(i.scheduledAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button className="btn-secondary btn-sm" onClick={() => openInvigilationEdit(i)}>
                                <Pencil className="w-4 h-4" /> Edit
                              </button>
                              <button
                                className="btn btn-sm text-primary-700 border border-primary-200 hover:bg-primary-50"
                                onClick={() => navigate(`/attendance/qr/${i.id}`)}
                                title="Show QR code"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                              <button
                                className="btn btn-sm text-amber-700 border border-amber-200 hover:bg-amber-50"
                                onClick={() => setReplaceModal({ open: true, invigilation: i, replacementId: '' })}
                              >
                                Replace
                              </button>
                              <button
                                className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                                onClick={() => {
                                  confirm({
                                    title: 'Remove this assignment?',
                                    description: 'The invigilator will no longer be assigned to this course session.',
                                    confirmText: 'Remove',
                                    tone: 'danger',
                                    onConfirm: () => removeInvigilation.mutate(i.id),
                                  });
                                }}
                              >
                                <Trash2 className="w-4 h-4" /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="p-10">
              <EmptyState icon={Eye} title="Select a session" description="Choose an examination session from the list to view and manage invigilations." />
            </div>
          )}
        </div>
      </div>

      <Modal
        open={sessionModal.open}
        onClose={closeSessionModal}
        title={sessionModal.session ? 'Edit Exam Session' : 'Create Exam Session'}
      >
        <form onSubmit={sessionForm.handleSubmit((v) => sessionModal.session ? updateSession.mutate({ id: sessionModal.session.id, payload: v }) : createSession.mutate(v))} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" {...sessionForm.register('name')} />
            {sessionForm.formState.errors.name && <p className="field-error">{sessionForm.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Semester</label>
            <select className="input" {...sessionForm.register('semesterId')}>
              <option value="">Select semester</option>
              {(semestersQuery.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.academicYear?.name} — {s.name}</option>
              ))}
            </select>
            {sessionForm.formState.errors.semesterId && <p className="field-error">{sessionForm.formState.errors.semesterId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input className="input" type="date" {...sessionForm.register('startDate')} />
              {sessionForm.formState.errors.startDate && <p className="field-error">{sessionForm.formState.errors.startDate.message}</p>}
            </div>
            <div>
              <label className="label">End date</label>
              <input className="input" type="date" {...sessionForm.register('endDate')} />
              {sessionForm.formState.errors.endDate && <p className="field-error">{sessionForm.formState.errors.endDate.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="session-published" type="checkbox" {...sessionForm.register('isPublished')} />
            <label htmlFor="session-published" className="text-sm text-ink-700">Published</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeSessionModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createSession.isPending || updateSession.isPending}>
              {(createSession.isPending || updateSession.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {sessionModal.session ? 'Save changes' : 'Create session'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={invigilationModal.open}
        onClose={closeInvigilationModal}
        title={invigilationModal.invigilation ? 'Edit invigilation' : 'Assign invigilator'}
      >
        <form onSubmit={invigilationForm.handleSubmit((v) => {
          const payload = { ...v, examinationSessionId: selectedSession.id };
          invigilationModal.invigilation ? updateInvigilation.mutate({ id: invigilationModal.invigilation.id, payload }) : createInvigilation.mutate(payload);
        })} className="space-y-4">
          <div>
            <label className="label">Course</label>
            <select className="input" {...invigilationForm.register('courseId')}>
              <option value="">Select approved course</option>
              {(coursesQuery.data || []).map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
            {invigilationForm.formState.errors.courseId && <p className="field-error">{invigilationForm.formState.errors.courseId.message}</p>}
          </div>
          <div>
            <label className="label">Invigilator</label>
            <select className="input" {...invigilationForm.register('invigilatorId')}>
              <option value="">Select invigilator</option>
              {(invigilatorsQuery.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
              ))}
            </select>
            {invigilationForm.formState.errors.invigilatorId && <p className="field-error">{invigilationForm.formState.errors.invigilatorId.message}</p>}
          </div>
          <div>
            <label className="label">Scheduled date & time</label>
            <input className="input" type="datetime-local" {...invigilationForm.register('scheduledAt')} />
            {invigilationForm.formState.errors.scheduledAt && <p className="field-error">{invigilationForm.formState.errors.scheduledAt.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Window opens</label>
              <input className="input" type="datetime-local" {...invigilationForm.register('windowOpensAt')} />
            </div>
            <div>
              <label className="label">Window closes</label>
              <input className="input" type="datetime-local" {...invigilationForm.register('windowClosesAt')} />
              {invigilationForm.formState.errors.windowClosesAt && <p className="field-error">{invigilationForm.formState.errors.windowClosesAt.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Grace period (min)</label>
            <input className="input" type="number" {...invigilationForm.register('gracePeriodMin')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeInvigilationModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createInvigilation.isPending || updateInvigilation.isPending}>
              {(createInvigilation.isPending || updateInvigilation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {invigilationModal.invigilation ? 'Save changes' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={replaceModal.open}
        onClose={() => setReplaceModal({ open: false, invigilation: null, replacementId: '' })}
        title="Replace invigilator"
        description={replaceModal.invigilation ? `Choose a replacement for ${replaceModal.invigilation.invigilator?.fullName}.` : ''}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Replacement invigilator</label>
            <select
              className="input"
              value={replaceModal.replacementId}
              onChange={(e) => setReplaceModal((m) => ({ ...m, replacementId: e.target.value }))}
            >
              <option value="">Select invigilator</option>
              {(invigilatorsQuery.data || [])
                .filter((u) => u.id !== replaceModal.invigilation?.invigilator?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setReplaceModal({ open: false, invigilation: null, replacementId: '' })}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!replaceModal.replacementId || replaceInvigilation.isPending}
              onClick={() => replaceInvigilation.mutate({ id: replaceModal.invigilation.id, replacementId: replaceModal.replacementId })}
            >
              {replaceInvigilation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Replace
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
