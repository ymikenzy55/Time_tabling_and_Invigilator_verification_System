import { cn } from '@/lib/cn';

/**
 * Console-style tab strip: green underline marks the active tab.
 *
 * tabs: [{ id: 'assignments', label: 'Assignments', count: 12, icon: Users }]
 */
export const Tabs = ({ tabs = [], value, onChange, className }) => (
  <div className={cn('tabs', className)} role="tablist">
    {tabs.map((tab) => {
      const Icon = tab.icon;
      const isActive = tab.id === value;
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          disabled={tab.disabled}
          onClick={() => onChange?.(tab.id)}
          className={cn('tab', isActive && 'tab-active', tab.disabled && 'opacity-40 cursor-not-allowed')}
        >
          <span className="inline-flex items-center gap-1.5">
            {Icon && <Icon className="w-4 h-4" />}
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span className="font-normal text-ink-500">({tab.count})</span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);
