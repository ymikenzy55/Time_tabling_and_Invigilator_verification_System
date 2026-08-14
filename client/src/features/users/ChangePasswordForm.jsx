import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi } from './usersApi';
import { strongPassword } from '@/lib/passwordRules';
import { PasswordChecklist, MatchIndicator } from './PasswordChecklist';

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: strongPassword(),
  confirm: z.string().min(1, 'Please confirm your new password.'),
}).refine((v) => v.newPassword === v.confirm, {
  message: 'Passwords do not match.',
  path: ['confirm'],
}).refine((v) => v.currentPassword !== v.newPassword, {
  message: 'New password must differ from your current password.',
  path: ['newPassword'],
});

const PwdInput = ({ id, label, register, error, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          className="input pr-10"
          {...register}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-ink-400 hover:text-ink-700"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="field-error">{error.message}</p>}
    </div>
  );
};

export const ChangePasswordForm = () => {
  const {
    register, handleSubmit, reset, watch, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const newPassword = watch('newPassword');
  const confirm = watch('confirm');

  const mutation = useMutation({
    mutationFn: (payload) => usersApi.changeMyPassword(payload),
    onSuccess: () => {
      toast.success('Your password has been updated.');
      reset();
    },
    onError: (err) => toast.error(err.message || 'Could not update password.'),
  });

  const onSubmit = (values) => {
    mutation.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
  };

  return (
    <div className="panel p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 grid place-items-center">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-ink-900">Change password</h3>
          <p className="text-sm text-ink-500">Choose a strong password you don't use elsewhere.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <PwdInput
          id="currentPassword"
          label="Current password"
          register={register('currentPassword')}
          error={errors.currentPassword}
          autoComplete="current-password"
        />
        <div>
          <PwdInput
            id="newPassword"
            label="New password"
            register={register('newPassword')}
            error={undefined}
            autoComplete="new-password"
          />
          <PasswordChecklist value={newPassword} />
        </div>
        <div>
          <PwdInput
            id="confirm"
            label="Confirm new password"
            register={register('confirm')}
            error={undefined}
            autoComplete="new-password"
          />
          <MatchIndicator password={newPassword} confirm={confirm} />
        </div>

        <div className="pt-2">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </div>
      </form>
    </div>
  );
};
