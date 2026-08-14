import { cn } from '@/lib/cn';

const VARIANTS = {
  neutral: 'bg-surface-subtle text-ink-700 border border-surface-border',
  primary: 'bg-primary-50 text-primary-800 border border-primary-200',
  info:    'bg-primary-50 text-primary-800 border border-primary-200',
  success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200',
  danger:  'bg-rose-50 text-rose-800 border border-rose-200',
  pending: 'bg-surface-subtle text-ink-500 border border-surface-border',
};

export const Badge = ({ variant = 'neutral', className, children }) => (
  <span className={cn('badge', VARIANTS[variant], className)}>{children}</span>
);
