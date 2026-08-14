import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Loader2, ShieldCheck, Eye, EyeOff, Pause, Play,
} from 'lucide-react';
import { usersApi } from './usersApi';
import { StatusBadge } from './StatusBadge';
import { PasswordChecklist } from './PasswordChecklist';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { strongPassword } from '@/lib/passwordRules';

const createSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  email: z.string().email('Please enter a valid email.'),
  staffId: z.string().trim().min(1, 'Staff ID is required.'),
  phone: z.string().trim().optional(),
  password: strongPassword(),
});

export const AdminsManager = () => {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const listQuery = useQuery({
    queryKey: ['users', { role: 'SUPER_ADMIN' }],
    queryFn: () => usersApi.list({ role: 'SUPER_ADMIN' }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => usersApi.create({ ...payload, role: 'SUPER_ADMIN' }),
    onSuccess: () => {
      toast.success('Administrator created.');
      qc.invalidateQueries({ queryKey: ['users', { role: 'SUPER_ADMIN' }] });
      setModalOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to create administrator.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data),
    onSuccess: () => {
      toast.success('Administrator updated.');
      qc.invalidateQueries({ queryKey: ['users', { role: 'SUPER_ADMIN' }] });
    },
    onError: (err) => toast.error(err.message || 'Failed to update administrator.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['users'] });
      const previous = qc.getQueriesData({ queryKey: ['users'] });
      qc.setQueriesData({ queryKey: ['users'] }, (prev) =>
        Array.isArray(prev) ? prev.filter((u) => u.id !== id) : prev
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Failed to remove administrator.');
    },
    onSuccess: () => {
      toast.success('Administrator removed.');
      setConfirmDelete(null);
    },
  });

  const {
    register, handleSubmit, reset, watch, formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createSchema),
    mode: 'onChange',
    defaultValues: { fullName: '', email: '', staffId: '', phone: '', password: '' },
  });

  const passwordValue = watch('password');

  const onSubmit = async (values) => {
    await createMutation.mutateAsync(values);
    reset();
    setShowPwd(false);
  };

  const admins = listQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink-900">Administrators</h3>
          <p className="text-sm text-ink-500">Manage all Super Admin accounts on this platform.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Add administrator
        </button>
      </div>

      {listQuery.isLoading && (
        <div className="panel p-10 grid place-items-center text-ink-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {!listQuery.isLoading && admins.length === 0 && (
        <EmptyState icon={ShieldCheck} title="No administrators yet" description="Add another Super Admin to share responsibility." />
      )}

      {admins.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Email</th>
                  <th className="text-left font-medium px-4 py-3">Staff ID</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-divider">
                {admins.map((u) => {
                  const isSelf = u.id === me?.id;
                  const isSuspended = u.status === 'SUSPENDED';
                  return (
                    <tr key={u.id} className="hover:bg-surface-subtle/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 grid place-items-center text-xs font-bold">
                            {(u.fullName || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-ink-900">{u.fullName}</div>
                            {isSelf && <div className="text-xs text-ink-500">You</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{u.email}</td>
                      <td className="px-4 py-3 text-ink-700">{u.staffId || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {!isSelf && (
                            <button
                              onClick={() =>
                                updateMutation.mutate({
                                  id: u.id,
                                  data: { status: isSuspended ? 'ACTIVE' : 'SUSPENDED' },
                                })
                              }
                              className="btn-secondary btn-sm"
                              disabled={updateMutation.isPending}
                              title={isSuspended ? 'Reactivate' : 'Suspend'}
                            >
                              {isSuspended ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                              {isSuspended ? 'Reactivate' : 'Suspend'}
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              onClick={() => setConfirmDelete(u)}
                              className="btn btn-sm text-rose-700 border border-rose-200 hover:bg-rose-50"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" /> Remove
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
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); reset(); setShowPwd(false); }}
        title="Add administrator"
        description="Create another Super Admin account. They can sign in immediately with the credentials you set."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div>
            <label className="label">Full name</label>
            <input className="input" placeholder="Jane Doe" {...register('fullName')} />
            {errors.fullName && <p className="field-error">{errors.fullName.message}</p>}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="jane@university.edu" {...register('email')} />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Staff ID</label>
              <input className="input" placeholder="SA-0002" {...register('staffId')} />
              {errors.staffId && <p className="field-error">{errors.staffId.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input className="input" placeholder="+233..." {...register('phone')} />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPwd ? 'text' : 'password'}
                placeholder="At least 8 characters"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-ink-400 hover:text-ink-700"
                tabIndex={-1}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordChecklist value={passwordValue} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setModalOpen(false); reset(); }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || createMutation.isPending}>
              {(isSubmitting || createMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              Create administrator
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Remove administrator"
        description={`This will permanently remove ${confirmDelete?.fullName || 'this user'}'s access. This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button
              className="btn btn-md bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, remove
            </button>
          </>
        }
      >
        <div className="text-sm text-ink-700">
          Email: <span className="font-medium">{confirmDelete?.email}</span>
        </div>
      </Modal>
    </div>
  );
};
