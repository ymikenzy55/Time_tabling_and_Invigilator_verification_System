import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Loader2, UserPlus, Users, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { usersApi } from '@/features/users/usersApi';
import { PasswordChecklist } from '@/features/users/PasswordChecklist';
import { strongPassword } from '@/lib/passwordRules';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  email: z.string().email('Please provide a valid email.'),
  staffId: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: strongPassword(),
});

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (err) {
    return '—';
  }
};

export const MyDepartmentHeadsPage = () => {
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      staffId: '',
      phone: '',
      password: '',
    },
  });

  const headsQuery = useQuery({
    queryKey: ['department-heads', 'peers'],
    queryFn: () => usersApi.listPeerDepartmentHeads(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => usersApi.createPeerDepartmentHead(payload),
    onSuccess: () => {
      toast.success('Department Head added.');
      qc.invalidateQueries({ queryKey: ['department-heads'] });
      reset();
      setShowPassword(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to add Department Head.'),
  });

  const passwordValue = watch('password');

  const heads = useMemo(() => headsQuery.data || [], [headsQuery.data]);

  const onSubmit = (values) => {
    createMutation.mutate({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      staffId: values.staffId?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      password: values.password,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Heads"
        description="Invite trusted colleagues to help manage your department's courses. New accounts are activated immediately."
        actions={(
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              document.getElementById('add-head-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <UserPlus className="w-4 h-4" />
            Add Department Head
          </button>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <div className="panel overflow-hidden">
          {headsQuery.isLoading ? (
            <SkeletonTable rows={4} cols={3} />
          ) : heads.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={Users}
                title="No Department Heads yet"
                description="As soon as you add your first Department Head, they will appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-ink-500 text-xs uppercase">
                  <tr>
                    <th className="text-left font-bold px-4 py-3">Name</th>
                    <th className="text-left font-bold px-4 py-3">Email</th>
                    <th className="text-left font-bold px-4 py-3">Staff ID</th>
                    <th className="text-left font-bold px-4 py-3">Phone</th>
                    <th className="text-left font-bold px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-divider">
                  {heads.map((head) => (
                    <tr key={head.id} className="hover:bg-surface-subtle">
                      <td className="px-4 py-3 font-bold text-ink-900">{head.fullName}</td>
                      <td className="px-4 py-3 text-ink-700">{head.email}</td>
                      <td className="px-4 py-3 text-ink-500">{head.staffId || '—'}</td>
                      <td className="px-4 py-3 text-ink-500">{head.phone || '—'}</td>
                      <td className="px-4 py-3 text-ink-500">{formatDate(head.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form
          id="add-head-form"
          className="panel p-5 space-y-4"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div>
            <h3 className="text-sm font-bold text-ink-900">Add Department Head</h3>
            <p className="text-xs text-ink-500 mt-1">
              Accounts created here can sign in immediately with the password you set. Share the credentials securely.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" {...register('fullName')} />
              {errors.fullName && (
                <p className="field-error">{errors.fullName.message}</p>
              )}
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" {...register('email')} />
              {errors.email && (
                <p className="field-error">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Staff ID (optional)</label>
              <input className="input" {...register('staffId')} />
              {errors.staffId && (
                <p className="field-error">{errors.staffId.message}</p>
              )}
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" {...register('phone')} />
              {errors.phone && (
                <p className="field-error">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="relative">
            <label className="label">Temporary password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-ink-400 hover:text-ink-700"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="field-error">{errors.password.message}</p>
            )}
            <PasswordChecklist value={passwordValue} />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>Create account</span>
          </button>
        </form>
      </div>
    </div>
  );
};
