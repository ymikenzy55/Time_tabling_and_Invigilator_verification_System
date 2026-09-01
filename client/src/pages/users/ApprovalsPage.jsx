import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Loader2, ShieldCheck, Clock, CheckCheck, Building,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { usersApi } from '@/features/users/usersApi';

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

const roleLabel = { DEPARTMENT_HEAD: 'Department Head', INVIGILATOR: 'Invigilator' };

const formatDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};

export const ApprovalsPage = () => {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [rejecting, setRejecting] = useState(null);
  // Which user is currently being approved, so only that card shows progress.
  const [approvingId, setApprovingId] = useState(null);

  const listQuery = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => usersApi.listPendingApprovals(),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const approveMutation = useMutation({
    mutationFn: (id) => usersApi.approveUser(id),
    onMutate: (id) => {
      setApprovingId(id);
      toast.loading('Approving account…', { id: `approve-${id}` });
    },
    onSuccess: (_data, id) => {
      toast.success('Account approved.', { id: `approve-${id}` });
      qc.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err, id) => {
      toast.error(err.message || 'Could not approve account.', { id: `approve-${id}` });
    },
    onSettled: () => setApprovingId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => usersApi.rejectUser(id, { reason }),
    onSuccess: () => {
      toast.success('Account rejected.');
      qc.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      setRejecting(null);
    },
    onError: (err) => toast.error(err.message || 'Could not reject account.'),
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(users.map((u) => usersApi.approveUser(u.id)));
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (failed > 0) throw new Error(`${failed} approval(s) failed.`);
      return succeeded;
    },
    onSuccess: (count) => {
      toast.success(`${count} account(s) approved.`);
      qc.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err.message || 'Some approvals failed.'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(rejectSchema),
  });

  const users = listQuery.data || [];

  return (
    <>
      <PageHeader
        title="Pending Approvals"
        description="Review and activate newly registered accounts."
        actions={users.length > 0 ? (
          <button
            className="btn-primary"
            onClick={async () => {
              const ok = await confirm({
                title: 'Approve all pending accounts?',
                description: `${users.length} account(s) will be activated and able to sign in.`,
                confirmText: 'Approve All',
                tone: 'primary',
              });
              if (ok) approveAllMutation.mutate();
            }}
            disabled={approveAllMutation.isPending || approveMutation.isPending}
          >
            {approveAllMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCheck className="w-4 h-4" />}
            Approve All ({users.length})
          </button>
        ) : undefined}
      />

      {listQuery.isLoading ? (
        <SkeletonCardGrid count={4} lines={3} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No pending approvals"
          description="All accounts are currently active. New users who register will appear here."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Name</th>
                    <th className="text-left font-medium px-4 py-3">Role</th>
                    <th className="text-left font-medium px-4 py-3">Staff ID</th>
                    <th className="text-left font-medium px-4 py-3">Department</th>
                    <th className="text-left font-medium px-4 py-3">Applied</th>
                    <th className="text-right font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-divider bg-white">
                  {users.map((u) => {
                    const isApproving = approvingId === u.id;
                    return (
                      <tr key={u.id} className={`hover:bg-surface-subtle/30 ${isApproving ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-600 text-white grid place-items-center text-xs font-bold shrink-0">
                              {(u.fullName || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-ink-900 truncate">{u.fullName}</div>
                              <div className="text-xs text-ink-500 truncate">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{roleLabel[u.role] || u.role}</td>
                        <td className="px-4 py-3 text-ink-500">{u.staffId || '—'}</td>
                        <td className="px-4 py-3 text-ink-500">
                          {u.role === 'DEPARTMENT_HEAD'
                            ? (u.departmentName || u.department?.name || '—')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-ink-500">{formatDate(u.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Approve this account?',
                                  description: `${u.fullName} will be able to sign in as a ${roleLabel[u.role] || u.role}.`,
                                  confirmText: 'Approve',
                                  tone: 'primary',
                                });
                                if (ok) approveMutation.mutate(u.id);
                              }}
                              disabled={approveMutation.isPending}
                            >
                              {isApproving
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CheckCircle2 className="w-3.5 h-3.5" />}
                              Approve
                            </button>
                            <button
                              className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                              onClick={() => { setRejecting(u); reset(); }}
                              disabled={approveMutation.isPending}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {users.map((u) => {
              const isApproving = approvingId === u.id;
              return (
                <div key={u.id} className={`panel p-4 ${isApproving ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-600 text-white grid place-items-center text-xs font-bold shrink-0">
                      {(u.fullName || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-ink-900 truncate">{u.fullName}</div>
                      <div className="text-xs text-ink-500 truncate">{u.email}</div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-600">
                        <span>{roleLabel[u.role] || u.role}</span>
                        {u.staffId && <span>· {u.staffId}</span>}
                      </div>
                      {u.role === 'DEPARTMENT_HEAD' && (u.departmentName || u.department?.name) && (
                        <div className="flex items-center gap-1 text-xs text-ink-500 mt-0.5">
                          <Building className="w-3 h-3" />
                          {u.departmentName || u.department?.name}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-ink-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(u.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      className="btn-primary btn-sm flex-1"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Approve this account?',
                          description: `${u.fullName} will be able to sign in as a ${roleLabel[u.role] || u.role}.`,
                          confirmText: 'Approve',
                          tone: 'primary',
                        });
                        if (ok) approveMutation.mutate(u.id);
                      }}
                      disabled={approveMutation.isPending}
                    >
                      {isApproving
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                      onClick={() => { setRejecting(u); reset(); }}
                      disabled={approveMutation.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject account"
        description={`Rejecting ${rejecting?.fullName}'s registration.`}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setRejecting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-md bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleSubmit((values) => rejectMutation.mutate({ id: rejecting.id, reason: values.reason }))}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, reject
            </button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={handleSubmit((values) => rejectMutation.mutate({ id: rejecting.id, reason: values.reason }))}>
          <div>
            <label className="label">Rejection reason (optional)</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="e.g. Incomplete staff verification..."
              {...register('reason')}
            />
            {errors.reason && <p className="field-error">{errors.reason.message}</p>}
          </div>
        </form>
      </Modal>
    </>
  );
};
