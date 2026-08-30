import { Sparkles } from 'lucide-react';

export const EmptyState = ({ icon: Icon = Sparkles, title, description, action }) => (
  <div className="panel px-6 py-12 flex flex-col items-center text-center">
    {Icon && (
      <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 grid place-items-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
    )}
    <h3 className="text-base font-bold text-ink-900">{title}</h3>
    {description && <p className="mt-1 text-sm text-ink-500 max-w-md leading-relaxed">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
