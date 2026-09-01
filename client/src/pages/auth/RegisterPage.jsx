import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Loader2, AlertTriangle, Eye, EyeOff, CheckCircle2, Calendar,
  ArrowLeft, ArrowRight, Check, Mail, KeyRound, RefreshCw, Timer,
} from 'lucide-react';
import { registrationApi } from '@/features/registration/registrationApi';
import { departmentsApi } from '@/features/academics/departmentsApi';
import { strongPassword } from '@/lib/passwordRules';
import { PasswordChecklist, MatchIndicator } from '@/features/users/PasswordChecklist';
import { authApi } from '@/features/auth/authApi';

const roleLabels = {
  DEPARTMENT_HEAD: 'Department Head',
  INVIGILATOR: 'Invigilator',
};

const buildSchema = (role) => z.object({
  role: z.enum(['DEPARTMENT_HEAD', 'INVIGILATOR']),
  email: z.string().email('Please enter a valid email address.'),
  fullName: z.string().trim().min(2, 'Full name is required.'),
  staffId: z.string().trim().min(1, 'Staff ID is required.'),
  phone: z.string().trim().optional(),
  password: strongPassword(),
  confirm: z.string().min(1, 'Please confirm your password.'),
  departmentName: z.string().trim().min(1, 'Department name is required.'),
}).refine((v) => v.password === v.confirm, {
  message: 'Passwords do not match.',
  path: ['confirm'],
});

const PwdInput = ({ id, label, register, autoComplete }) => {
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
    </div>
  );
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '';

const SuccessScreen = ({ onDone }) => {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 grid place-items-center mx-auto mb-4">
        <CheckCircle2 className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-ink-900">Application submitted</h2>
      <p className="mt-2 text-sm text-ink-500">
        Your account is under review. Once an Exam Officer approves it, you can sign in.
      </p>
      <p className="mt-3 text-xs text-ink-400">
        Redirecting to sign in…
      </p>
      <button className="btn-primary mt-4 w-full" onClick={onDone}>
        Back to sign in
      </button>
    </div>
  );
};

const VerifyEmailStep = ({ email, onVerified, onBack }) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputsRef = useRef([]);

  const sendCode = useCallback(async () => {
    setSending(true);
    setError('');
    try {
      await authApi.sendVerificationCode(email);
      toast.success('Verification code sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to send verification code.');
      toast.error(err.message || 'Failed to send verification code.');
    } finally {
      setSending(false);
    }
  }, [email]);

  useEffect(() => {
    sendCode();
  }, [sendCode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleCodeChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[idx] = val;
    setCode(next);
    setError('');
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const next = pasted.split('');
      while (next.length < 6) next.push('');
      setCode(next);
      inputsRef.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await authApi.verifyEmail(email, fullCode);
      setVerified(true);
      toast.success('Email verified successfully!');
      setTimeout(() => onVerified(fullCode), 1500);
    } catch (err) {
      setError(err.message || 'Invalid or expired code.');
      toast.error(err.message || 'Invalid or expired code.');
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 grid place-items-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-ink-900">Email Verified!</h3>
        <p className="mt-2 text-sm text-ink-500">Submitting your registration…</p>
        <Loader2 className="w-5 h-5 text-primary-600 animate-spin mx-auto mt-3" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-14 h-14 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center mx-auto mb-4">
          <KeyRound className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-ink-900">Verify your email</h3>
        <p className="mt-2 text-sm text-ink-500">
          Enter the 6-digit code sent to <strong className="text-ink-700">{email}</strong>
        </p>
      </div>

      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {code.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleCodeChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            disabled={verifying}
            className="w-11 h-12 text-center text-xl font-bold border-2 rounded-lg focus:border-primary-600 focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
            style={{ borderColor: error ? '#fca5a5' : digit ? '#16a34a' : undefined }}
          />
        ))}
      </div>

      {error && <p className="text-center text-sm text-rose-600">{error}</p>}

      <button
        type="button"
        onClick={handleVerify}
        disabled={verifying || code.join('').length !== 6}
        className="btn-primary w-full"
      >
        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        {verifying ? 'Verifying…' : 'Verify email'}
      </button>

      <div className="flex items-center justify-center gap-2 text-sm">
        {resendCooldown > 0 ? (
          <span className="text-ink-500 flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" /> Resend in {resendCooldown}s
          </span>
        ) : (
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="text-primary-700 hover:text-primary-800 font-bold flex items-center gap-1"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Resend code
          </button>
        )}
      </div>

      <button type="button" onClick={onBack} className="btn-ghost w-full text-sm">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to form
      </button>
    </div>
  );
};

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  const [staffIdCheck, setStaffIdCheck] = useState({ checking: false, available: null, message: '' });
  const [emailCheck, setEmailCheck] = useState({ checking: false, available: null, message: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerifyStep, setShowVerifyStep] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['registration', 'status'],
    queryFn: () => registrationApi.status(),
    refetchInterval: 60000,
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments', 'public'],
    queryFn: () => departmentsApi.listNames(),
    staleTime: 5 * 60_000,
  });

  const schema = useMemo(() => buildSchema(role), [role]);

  const [step, setStep] = useState(0);

  const {
    register: rf, handleSubmit, watch, reset, setValue, trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      role: '', email: '', fullName: '', staffId: '', phone: '',
      password: '', confirm: '', departmentName: '',
    },
  });

  useEffect(() => {
    setValue('role', role);
  }, [role, setValue]);

  const password = watch('password');
  const confirm = watch('confirm');
  const emailValue = watch('email');
  const staffIdValue = watch('staffId');

  // Real-time email check on blur
  const checkEmailAvailability = async (email) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setEmailCheck({ checking: true, available: null, message: '' });
    try {
      const result = await registrationApi.checkEmail(email);
      setEmailCheck({
        checking: false,
        available: result.available,
        message: result.available ? 'Email is available.' : 'This email is already registered.',
      });
    } catch {
      setEmailCheck({ checking: false, available: null, message: '' });
    }
  };

  // Real-time staff ID check on blur
  const checkStaffIdAvailability = async (staffId) => {
    if (!staffId || staffId.trim().length < 1) return;
    setStaffIdCheck({ checking: true, available: null, message: '' });
    try {
      const result = await registrationApi.checkStaffId(staffId);
      setStaffIdCheck({
        checking: false,
        available: result.available,
        message: result.available ? 'Staff ID is available.' : 'This Staff ID is already in use.',
      });
    } catch {
      setStaffIdCheck({ checking: false, available: null, message: '' });
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (values) => {
      return registrationApi.register({
        role: values.role,
        email: values.email,
        fullName: values.fullName,
        staffId: values.staffId,
        phone: values.phone || undefined,
        password: values.password,
        departmentName: values.departmentName,
        verificationCode,
      });
    },
    onSuccess: () => {
      toast.success('Account submitted. Awaiting Exam Officer approval.');
      reset();
    },
    onError: (err) => toast.error(err.message || 'Registration failed. Please check your details and try again.'),
  });

  const handleVerified = (code) => {
    setVerificationCode(code);
    setShowVerifyStep(false);
    // Auto-submit after verification
    const values = {
      role,
      email: emailValue,
      fullName: watch('fullName'),
      staffId: staffIdValue,
      phone: watch('phone'),
      password: watch('password'),
      departmentName: watch('departmentName'),
    };
    submitMutation.mutate(values);
  };

  if (statusQuery.isLoading) {
    return (
      <div className="py-10 flex flex-col items-center text-ink-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="mt-3 text-sm">Checking registration availability…</p>
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 grid place-items-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900">Cannot reach the server</h2>
            <p className="text-sm text-ink-500">
              {statusQuery.error?.message || 'The registration service is unavailable right now.'}
            </p>
          </div>
        </div>
        <Link to="/login" className="btn-secondary mt-4 inline-flex w-full justify-center">Back to sign in</Link>
      </div>
    );
  }

  const roles = statusQuery.data?.roles || [];
  const openRoles = roles.filter((r) => r.open);
  const nextOpen = roles.find((r) => !r.open && r.opensAt && new Date(r.opensAt) > new Date());

  if (submitMutation.isSuccess) {
    return <SuccessScreen onDone={() => navigate('/login', { replace: true })} />;
  }

  if (!openRoles.length) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 grid place-items-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900">Registration closed</h2>
            <p className="text-sm text-ink-500">There are no active registration windows right now.</p>
          </div>
        </div>
        {nextOpen && (
          <div className="rounded-lg border border-surface-border bg-surface-subtle p-4 text-sm text-ink-700 flex items-start gap-3">
            <Calendar className="w-4 h-4 mt-0.5 text-ink-500" />
            <div>
              Registration for <strong>{roleLabels[nextOpen.role]}</strong> opens on{' '}
              <strong>{formatDate(nextOpen.opensAt)}</strong>.
            </div>
          </div>
        )}
        <Link to="/login" className="btn-secondary mt-6 inline-flex w-full justify-center">Back to sign in</Link>
      </div>
    );
  }

  const stepFields = [
    ['fullName', 'email', 'staffId', 'phone'],
    ['departmentName'],
    ['password', 'confirm'],
  ];
  const stepLabels = ['Personal', 'Department', 'Security'];
  const totalSteps = stepFields.length;
  const isLastStep = step === totalSteps - 1;

  const handleNext = async () => {
    // Validate current step fields
    const valid = await trigger(stepFields[step]);
    if (!valid) {
      const invalidFields = stepFields[step].filter(field => errors[field]);
      if (invalidFields.length > 0) {
        const fieldNames = invalidFields.map(f => {
          const labels = {
            fullName: 'Full name',
            email: 'Email address',
            staffId: 'Staff ID',
            phone: 'Phone',
            departmentName: 'Department',
            password: 'Password',
            confirm: 'Confirm password',
          };
          return labels[f] || f;
        });
        toast.error(`Please fix: ${fieldNames.join(', ')}`);
      }
      return;
    }

    // Step 0: Check staff ID and email availability before proceeding
    if (step === 0) {
      const staffId = watch('staffId')?.trim();
      const email = watch('email')?.trim();

      if (!staffId) {
        toast.error('Staff ID is required');
        return;
      }

      setStaffIdCheck({ checking: true, available: null, message: '' });
      setEmailCheck({ checking: true, available: null, message: '' });

      try {
        const staffIdResult = await registrationApi.checkStaffId(staffId);
        if (!staffIdResult.available) {
          setStaffIdCheck({ checking: false, available: false, message: 'This Staff ID is already in use.' });
          toast.error('This Staff ID is already in use.');
          return;
        }

        const emailResult = await registrationApi.checkEmail(email);
        if (!emailResult.available) {
          setEmailCheck({ checking: false, available: false, message: 'This email is already registered.' });
          setStaffIdCheck({ checking: false, available: true, message: 'Staff ID is available.' });
          toast.error('This email is already registered.');
          return;
        }

        setStaffIdCheck({ checking: false, available: true, message: 'Staff ID is available.' });
        setEmailCheck({ checking: false, available: true, message: 'Email is available.' });
        toast.success('Staff ID and email are available!');
      } catch (err) {
        setStaffIdCheck({ checking: false, available: null, message: '' });
        setEmailCheck({ checking: false, available: null, message: '' });
        toast.error(err.message || 'Could not verify availability.');
        return;
      }
    }

    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  if (showVerifyStep) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900">Email Verification</h2>
            <p className="text-sm text-ink-500">Final step before submitting your registration.</p>
          </div>
        </div>
        <VerifyEmailStep
          email={emailValue}
          onVerified={handleVerified}
          onBack={() => setShowVerifyStep(false)}
        />
        <Link to="/login" className="btn-ghost mt-6 inline-flex w-full">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink-900">Create your account</h2>
          <p className="text-sm text-ink-500">
            Choose your role and complete the form below.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Registering as</label>
        <div className="grid grid-cols-2 gap-2">
          {openRoles.map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => { setRole(r.role); setStep(0); }}
              className={`p-3 rounded-lg border text-sm font-bold text-left transition-colors ${
                role === r.role
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-surface-border hover:bg-surface-subtle text-ink-700'
              }`}
            >
              <div>{roleLabels[r.role]}</div>
              <div className="text-xs text-ink-500 mt-0.5">
                Open until {formatDate(r.closesAt)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {!role ? (
        <p className="text-sm text-ink-500 text-center">Select a role to continue.</p>
      ) : (
        <form onSubmit={handleSubmit(async (v) => {
          // Validate ALL steps before proceeding to verification
          const allFields = stepFields.flat();
          const valid = await trigger(allFields);
          if (!valid) {
            const errorMessages = [];
            if (errors.fullName) errorMessages.push('Full name is required');
            if (errors.email) errorMessages.push('Valid email is required');
            if (errors.staffId) errorMessages.push('Staff ID is required');
            if (errors.departmentName) errorMessages.push('Department is required');
            if (errors.password) errorMessages.push('Password does not meet requirements');
            if (errors.confirm) errorMessages.push(errors.confirm.message || 'Passwords do not match');
            toast.error(`Please fix these issues:\n${errorMessages.join('\n')}`);
            return;
          }
          // Re-check staff ID and email before proceeding to verification
          try {
            const staffIdResult = await registrationApi.checkStaffId(v.staffId);
            if (!staffIdResult.available) {
              toast.error('This Staff ID is already in use. Please go back and change it.');
              setStep(0);
              return;
            }
            const emailResult = await registrationApi.checkEmail(v.email);
            if (!emailResult.available) {
              toast.error('This email is already registered. Please go back and change it.');
              setStep(0);
              return;
            }
          } catch {
            toast.error('Could not verify availability. Please try again.');
            return;
          }
          // Proceed to email verification step
          setShowVerifyStep(true);
        })} className="space-y-4" noValidate>
          <input type="hidden" value={role} {...rf('role')} />

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${i <= step ? 'text-primary-700' : 'text-ink-400'}`}>
                  <div className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold border ${
                    i < step
                      ? 'bg-primary-600 text-white border-primary-600'
                      : i === step
                        ? 'border-primary-600 text-primary-700'
                        : 'border-surface-border text-ink-400'
                  }`}>
                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="text-xs font-bold hidden sm:inline">{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-px ${i < step ? 'bg-primary-600' : 'bg-surface-border'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" placeholder="Enter your name" {...rf('fullName')} />
                {errors.fullName && <p className="field-error">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="label">Email address</label>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  {...rf('email')}
                  onBlur={(e) => checkEmailAvailability(e.target.value.trim())}
                />
                {errors.email && <p className="field-error">{errors.email.message}</p>}
                {emailCheck.checking && (
                  <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking…
                  </p>
                )}
                {emailCheck.available === false && (
                  <p className="field-error mt-1">{emailCheck.message}</p>
                )}
                {emailCheck.available === true && !errors.email && (
                  <p className="text-xs text-emerald-600 mt-1">{emailCheck.message}</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Staff ID</label>
                  <input
                    className="input"
                    placeholder="e.g. DH-0001"
                    {...rf('staffId')}
                    onBlur={(e) => checkStaffIdAvailability(e.target.value.trim())}
                  />
                  {errors.staffId && <p className="field-error">{errors.staffId.message}</p>}
                  {staffIdCheck.checking && (
                    <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking…
                    </p>
                  )}
                  {staffIdCheck.available === false && (
                    <p className="field-error mt-1">{staffIdCheck.message}</p>
                  )}
                  {staffIdCheck.available === true && !errors.staffId && (
                    <p className="text-xs text-emerald-600 mt-1">{staffIdCheck.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Phone (optional)</label>
                  <input className="input" placeholder="+233..." {...rf('phone')} />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Department */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">
                  {role === 'DEPARTMENT_HEAD' ? 'Department you are heading' : 'Your department'}
                </label>
                <select
                  className="input"
                  {...rf('departmentName')}
                  defaultValue=""
                >
                  <option value="" disabled>Select a department</option>
                  {departmentsQuery.data?.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.departmentName && <p className="field-error">{errors.departmentName.message}</p>}
                {departmentsQuery.isLoading && (
                  <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading departments…
                  </p>
                )}
                {departmentsQuery.data?.length === 0 && !departmentsQuery.isLoading && (
                  <p className="text-xs text-ink-500 mt-1">
                    No departments available yet. Please contact the Examination Office.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Security */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <PwdInput id="password" label="Password" register={rf('password')} autoComplete="new-password" />
                <PasswordChecklist value={password} />
              </div>
              <div>
                <PwdInput id="confirm" label="Confirm password" register={rf('confirm')} autoComplete="new-password" />
                <MatchIndicator password={password} confirm={confirm} />
                {errors.confirm && <p className="field-error">{errors.confirm.message}</p>}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center gap-2 pt-2">
            {step > 0 && (
              <button type="button" className="btn-secondary" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {!isLastStep ? (
              <button type="button" className="btn-primary ml-auto" onClick={handleNext} disabled={staffIdCheck.checking || emailCheck.checking}>
                {(staffIdCheck.checking || emailCheck.checking) ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Next
              </button>
            ) : (
              <button type="submit" className="btn-primary ml-auto" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {submitMutation.isPending ? 'Submitting…' : 'Verify & Submit'}
              </button>
            )}
          </div>
        </form>
      )}

      <Link to="/login" className="btn-ghost mt-6 inline-flex w-full">Back to sign in</Link>
    </div>
  );
};
