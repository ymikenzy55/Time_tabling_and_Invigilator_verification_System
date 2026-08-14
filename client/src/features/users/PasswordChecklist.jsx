import { Check, Circle } from 'lucide-react';
import { evaluatePassword } from '@/lib/passwordRules';
import { cn } from '@/lib/cn';

export const PasswordChecklist = ({ value }) => {
  const items = evaluatePassword(value || '');
  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {items.map(({ id, label, met }) => (
        <li
          key={id}
          className={cn(
            'flex items-center gap-2 text-sm font-medium transition-colors',
            met ? 'text-emerald-700' : 'text-ink-500'
          )}
        >
          {met ? (
            <Check className="w-4 h-4 shrink-0 stroke-[3]" />
          ) : (
            <Circle className="w-4 h-4 shrink-0 stroke-[2]" />
          )}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
};

export const MatchIndicator = ({ password, confirm }) => {
  if (!confirm) return null;
  const matches = password === confirm;
  return (
    <p
      className={cn(
        'mt-1 text-sm font-medium flex items-center gap-1.5',
        matches ? 'text-emerald-700' : 'text-rose-600'
      )}
      aria-live="polite"
    >
      {matches ? <Check className="w-4 h-4 stroke-[3]" /> : <Circle className="w-4 h-4 stroke-[2]" />}
      {matches ? 'Passwords match.' : 'Passwords do not match yet.'}
    </p>
  );
};
