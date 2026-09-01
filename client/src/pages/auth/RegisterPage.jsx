import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Loader2, AlertTriangle, Eye, EyeOff, CheckCircle2, Calendar,
  ArrowLeft, ArrowRight, Check, Mail,
} from 'lucide-react';
import { registrationApi } from '@/features/registration/registrationApi';
import { departmentsApi } from '@/features/academics/departmentsApi';
import { strongPassword } from '@/lib/passwordRules';
import { PasswordChecklist, MatchIndicator } from '@/features/users/PasswordChecklist';

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
      <h2 className="text-xl font-bold text-ink-900">Email verified & application submitted</h2>
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

const VerificationStep = ({ email, code, setCode, onVerify, onResend, isVerifying, isResending, error, attemptsLeft }) => {
  const inputs = [0, 1, 2, 3, 4, 5];

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = code.split('');
    newCode[index] = value;
    setCode(newCode.join(''));

    // Auto-focus next input
    if (value && index < 5) {
      const next = document.getElementById(`code-${index + 1}`);
      next?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prev = document.getElementById(`code-${index - 1}`);
      prev?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      setCode(pasted.padEnd(6, '').slice(0, 6));
      const lastFilled = Math.min(pasted.length, 5);
      document.getElementById(`code-${lastFilled}`)?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center mx-auto mb-3">
          <Mail className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-ink-900">Verify your email</h3>
        <p className="mt-1 text-sm text-ink-500">
          Enter the 6-digit code sent to <strong className="text-ink-700">{email}</strong>
        </p>
      </div>

      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {inputs.map((i) => (
          <input
            key={i}
            id={`code-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={code[i] || ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-12 h-14 text-center text-xl font-bold border-2 rounded-lg focus:outline-none focus:border-primary-600 transition-colors"
            style={{ borderColor: error ? '#ef4444' : code[i] ? '#4f46e5' : '#e2e8f0' }}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-rose-600 text-center">{error}</p>
      )}

      {attemptsLeft !== null && attemptsLeft !== undefined && attemptsLeft < 5 && attemptsLeft > 0 && !error && (
        <p className="text-xs text-amber-600 text-center">
          {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-500">Didn't receive a code?</span>
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="text-primary-600 font-semibold hover:text-primary-700 disabled:opacity-50"
        >
          {isResending ? 'Sending…' : 'Resend code'}
        </button>
      </div>

      <button
        type="button"
        onClick={onVerify}
        disabled={isVerifying || code.length !== 6}
        className="btn-primary w-full"
      >
        {isVerifying ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
        ) : (
          <><CheckCircle2 className="w-4 h-4" /> Verify & Submit</>
        )}
      </button>
    </div>
  );
};


export const RegisterPage = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  const [staffIdCheck, setStaffIdCheck] = useState({ checking: false, available: null, message: '' });
  const [emailCheck, setEmailCheck] = useState({ checking: false, available: null, message: '' });

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
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(null);

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

  const sendCodeMutation = useMutation({
    mutationFn: (payload) => registrationApi.sendVerificationCode(payload),
  });

  const verifyMutation = useMutation({
    mutationFn: (payload) => registrationApi.verifyAndRegister(payload),
    onSuccess: () => {
      toast.success('Email verified! Your application has been submitted.');
      reset();
    },
    onError: (err) => {
      const msg = err.message || 'Verification failed.';
      setVerifyError(msg);
      // Extract attempts remaining from error message if present
      const match = msg.match(/(\d+) attempt/);
      if (match) setAttemptsLeft(parseInt(match[1], 10));
      if (msg.includes('expired') || msg.includes('request a new')) {
        setVerificationCode('');
        setAttemptsLeft(null);
      }
    },
  });

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

  if (verifyMutation.isSuccess) {
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
  const stepLabels = ['Personal', 'Department', 'Security', 'Verify'];
  const totalSteps = stepLabels.length; // 4 steps including Verify
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

    // Step 2 (Security): send verification code before advancing to verification step
    if (step === 2) {
      const allValid = await trigger(stepFields[2]);
      if (!allValid) {
        const invalidFields = stepFields[2].filter(field => errors[field]);
        if (invalidFields.length > 0) {
          const labels = {
            password: 'Password',
            confirm: 'Confirm password',
          };
          const fieldNames = invalidFields.map(f => labels[f] || f);
          toast.error(`Please fix: ${fieldNames.join(', ')}`);
        }
        return;
      }
      const values = watch();
      try {
        await sendCodeMutation.mutateAsync({
          role: values.role,
          email: values.email,
        });
        toast.success('A 6-digit verification code has been sent to your email.');
        setVerifyError('');
        setAttemptsLeft(null);
        setVerificationCode('');
        setStep((s) => s + 1);
      } catch (err) {
        toast.error(err.message || 'Failed to send verification code.');
      }
      return;
    }

    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

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
        <form onSubmit={handleSubmit((v) => {
          // The old direct submit is replaced by the verification flow.
          // If we somehow get here, redirect to the verification step.
          if (step < 3) {
            handleNext();
          }
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

          {/* Step 3: Email Verification */}
          {step === 3 && (
            <VerificationStep
              email={watch('email')}
              code={verificationCode}
              setCode={setVerificationCode}
              onVerify={async () => {
                setVerifyError('');
                const values = watch();
                try {
                  await verifyMutation.mutateAsync({
                    role: values.role,
                    email: values.email,
                    fullName: values.fullName,
                    staffId: values.staffId,
                    phone: values.phone || undefined,
                    password: values.password,
                    departmentName: values.departmentName,
                    verificationCode,
                  });
                } catch (err) {
                  // error handled in onError callback
                }
              }}
              onResend={async () => {
                setVerifyError('');
                setAttemptsLeft(null);
                setVerificationCode('');
                const values = watch();
                try {
                  await sendCodeMutation.mutateAsync({
                    role: values.role,
                    email: values.email,
                  });
                  toast.success('A new verification code has been sent.');
                } catch (err) {
                  toast.error(err.message || 'Failed to resend code.');
                }
              }}
              isVerifying={verifyMutation.isPending}
              isResending={sendCodeMutation.isPending}
              error={verifyError}
              attemptsLeft={attemptsLeft}
            />
          )}

          {/* Navigation buttons */}
          <div className="flex items-center gap-2 pt-2">
            {step > 0 && step < 3 && (
              <button type="button" className="btn-secondary" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step === 3 ? (
              <button type="button" className="btn-secondary ml-auto" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" /> Back to form
              </button>
            ) : step < 3 ? (
              <button type="button" className="btn-primary ml-auto" onClick={handleNext} disabled={sendCodeMutation.isPending}>
                {sendCodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (step === 2 ? <Mail className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />)}
                {step === 2 ? 'Send Verification Code' : 'Next'}
              </button>
            : null}
          </div>
        </form>
      )}

      <Link to="/login" className="btn-ghost mt-6 inline-flex w-full">Back to sign in</Link>
    </div>
  );
};
