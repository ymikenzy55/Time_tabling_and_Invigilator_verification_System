import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { authApi } from '@/features/auth/authApi';
import { strongPassword } from '@/lib/passwordRules';
import { PasswordChecklist, MatchIndicator } from '@/features/users/PasswordChecklist';
import toast from 'react-hot-toast';

const schema = z.object({
  newPassword: strongPassword(),
  confirm: z.string().min(1, 'Please confirm your new password.'),
}).refine((v) => v.newPassword === v.confirm, {
  message: 'Passwords do not match.',
  path: ['confirm'],
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

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const {
    register, handleSubmit, watch, reset, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirm: '' },
  });

  const newPassword = watch('newPassword');
  const confirm = watch('confirm');

  const mutation = useMutation({
    mutationFn: (values) => authApi.resetPassword({ token, newPassword: values.newPassword, confirm: values.confirm }),
    onSuccess: (data) => {
      toast.success(data.message || 'Password reset successfully.');
      setSuccess(true);
      reset();
    },
    onError: (err) => toast.error(err.message || 'Could not reset password.'),
  });

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="panel p-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 grid place-items-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-ink-900 mb-2">Invalid reset link</h2>
          <p className="text-sm text-ink-500 mb-6">
            This page requires a valid reset token. Please use the link from your password reset email.
          </p>
          <Link to="/login" className="btn-primary w-full">Back to sign in</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="panel p-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 grid place-items-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-ink-900 mb-2">Password reset complete</h2>
          <p className="text-sm text-ink-500 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <button className="btn-primary w-full" onClick={() => navigate('/login')}>
            Continue to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center mx-auto mb-4">
          <KeyRound className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-ink-900">Set a new password</h2>
        <p className="mt-2 text-sm text-ink-500">
          Choose a strong password for your account.
        </p>
      </div>

      <div className="panel p-5">
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
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
              error={errors.confirm}
              autoComplete="new-password"
            />
            <MatchIndicator password={newPassword} confirm={confirm} />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Reset password
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-ink-500">
        Remember your password?{' '}
        <Link to="/login" className="font-bold text-primary-700 hover:text-primary-800">
          Sign in
        </Link>
      </p>
    </div>
  );
};
