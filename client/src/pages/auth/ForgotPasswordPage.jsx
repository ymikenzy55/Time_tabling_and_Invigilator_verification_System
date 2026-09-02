import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/features/auth/authApi';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  const {
    register, handleSubmit, formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const mutation = useMutation({
    mutationFn: (values) => {
      setEmail(values.email);
      return authApi.forgotPassword(values.email);
    },
    onSuccess: (data) => {
      setSent(true);
      toast.success(data.message || 'Password reset link sent.');
    },
    onError: (err) => toast.error(err.message || 'Could not send reset link.'),
  });

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 grid place-items-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-ink-900 mb-2">Check your email</h2>
        <p className="text-sm text-ink-600 mb-1">
          If an account exists for <strong>{email}</strong>, a password reset link has been sent.
        </p>
        <p className="text-xs text-ink-500 mb-6">
          Check your inbox (and spam folder) for the password reset email. The link will expire in 1 hour.
        </p>
        <button className="btn-primary w-full" onClick={() => navigate('/login')}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center mx-auto mb-4">
          <Mail className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-ink-900">Reset your password</h2>
        <p className="mt-2 text-sm text-ink-500">
          Enter your email address and we'll send you a password reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="forgot-email">Email address</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              className="input pl-9"
              placeholder="you@university.edu"
              {...register('email')}
              disabled={mutation.isPending}
            />
          </div>
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {mutation.isPending ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate('/login')}
        className="mt-6 w-full text-sm text-ink-500 hover:text-ink-700 flex items-center justify-center gap-1"
        disabled={mutation.isPending}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
      </button>
    </div>
  );
};
