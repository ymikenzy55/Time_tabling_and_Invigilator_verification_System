import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Loader2, ShieldCheck, UserCircle, Clock, Search, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
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

  const listQuery = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => usersApi.listPendingApprovals(),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const approveMutation = useMutation({
    mutationFn: (id) => usersApi.approveUser(id),
    onSuccess: () => {
      toast.success('Account approved.');
      qc.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err.message || 'Could not approve account.'),
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(rejectSchema),
  });

  const users = listQuery.data || [];

  return (
    <>
      <PageHeader
        title="Pending Approvals"
        description="Review and activate newly registered accounts."
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((u) => (
            <div key={u.id} className="panel p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-600 text-white grid place-items-center text-sm font-bold">
                  {(u.fullName || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink-900">{u.fullName}</div>
                  <div className="text-sm text-ink-500 truncate">{u.email}</div>
                </div>
                <Badge variant="warning">Pending</Badge>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-ink-700">
                  <UserCircle className="w-4 h-4 text-ink-400" />
                  {roleLabel[u.role] || u.role}
                </div>
                <div className="flex items-center gap-2 text-ink-700">
                  <AlertCircle className="w-4 h-4 text-ink-400" />
                  Staff ID: {u.staffId || '—'}
                </div>
                {u.role === 'DEPARTMENT_HEAD' && (
                  <div className="flex items-center gap-2 text-ink-700">
                    <span className="w-4 h-4 text-ink-400">Dept</span>
                    Department: {u.departmentName || u.department?.name || '—'}
                  </div>
                )}
                <div className="flex items-center gap-2 text-ink-700">
                  <Clock className="w-4 h-4 text-ink-400" />
                  Applied: {formatDate(u.createdAt)}
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <button
                  className="btn-primary flex-1"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Approve this account?',
                      description: `${u.fullName} (${u.email}) will be able to sign in as a ${roleLabel[u.role] || u.role}.`,
                      confirmText: 'Approve',
                      tone: 'primary',
                    });
                    if (ok) approveMutation.mutate(u.id);
                  }}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
                <button
                  className="btn btn-md flex-1 text-rose-700 border border-rose-200 hover:bg-rose-50"
                  onClick={() => { setRejecting(u); reset(); }}
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
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
