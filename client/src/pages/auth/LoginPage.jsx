import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, LogIn, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { registrationApi } from '@/features/registration/registrationApi';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      const roleDefault = '/dashboard';

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
          <div className="min-h-[20px]">
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>
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
          <div className="min-h-[20px]">
            {errors.password && <p className="field-error">{errors.password.message}</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="btn-link text-xs"
          >
            Forgot password?
          </Link>
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

    </div>
  );
};
