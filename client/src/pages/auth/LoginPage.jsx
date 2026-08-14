import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, LogIn, Eye, EyeOff, UserPlus, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { registrationApi } from '@/features/registration/registrationApi';
import { authApi } from '@/features/auth/authApi';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    reset: resetForgot,
    formState: { errors: forgotErrors },
  } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const forgotMutation = useMutation({
    mutationFn: (values) => authApi.forgotPassword(values.email),
    onSuccess: (data) => {
      setForgotSent(true);
      toast.success(data.message || 'Password reset link sent.');
    },
    onError: (err) => toast.error(err.message || 'Could not process request.'),
  });

  const onForgotSubmit = (values) => {
    forgotMutation.mutate(values);
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotSent(false);
    resetForgot();
  };

  const statusQuery = useQuery({
    queryKey: ['registration', 'status'],
    queryFn: () => registrationApi.status(),
    refetchInterval: 60000,
  });
  const registrationOpen = !!statusQuery.data?.anyOpen;

  const {
    register, handleSubmit, formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const authenticatedUser = await login(values);
      const fromLocation = location.state?.from?.pathname;
      const roleDefault = {
        SUPER_ADMIN: '/dashboard',
        DEPARTMENT_HEAD: '/courses',
        INVIGILATOR: '/my-assignments',
      }[authenticatedUser.role] || '/dashboard';

      const redirectTo = fromLocation && fromLocation !== '/login'
        ? fromLocation
        : roleDefault;

      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Sign in failed.');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-ink-900">Sign in</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@university.edu"
            {...register('email')}
          />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="input pr-10"
              placeholder="Enter your password"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-700 focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="field-error">{errors.password.message}</p>}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="btn-link text-xs"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {registrationOpen ? (
        <div className="mt-6 text-center">
          <p className="text-sm text-ink-500">Don't have an account?</p>
          <Link
            to="/register"
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:text-primary-800"
          >
            <UserPlus className="w-4 h-4" /> Register
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-xs text-ink-500 text-center">
          Account registration is currently closed. Please contact the Examination Office for access.
        </p>
      )}

      <Modal
        open={forgotOpen}
        onClose={closeForgot}
        title="Reset your password"
        description={forgotSent ? undefined : 'Enter the email you used during registration and we\'ll send you a reset link.'}
        size="sm"
      >
        {forgotSent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 grid place-items-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm text-ink-700 mb-1">
              If an account exists for that email, a reset link has been sent.
            </p>
            <p className="text-xs text-ink-500 mb-6">
              Check your inbox (and spam folder) for the password reset email.
            </p>
            <button className="btn-primary w-full" onClick={closeForgot}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit(onForgotSubmit)} className="space-y-4" noValidate>
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
                  {...registerForgot('email')}
                />
              </div>
              {forgotErrors.email && <p className="field-error">{forgotErrors.email.message}</p>}
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={forgotMutation.isPending}
            >
              {forgotMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send reset link
            </button>
            <button
              type="button"
              onClick={closeForgot}
              className="w-full text-sm text-ink-500 hover:text-ink-700 flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};
