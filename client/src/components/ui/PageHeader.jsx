import { Breadcrumbs } from './Breadcrumbs';
import { cn } from '@/lib/cn';

/**
 * Console page heading.
 *
 * - `breadcrumbs`: [{ label, to }] rendered above the title
 * - `counter`: shown in muted parentheses after the title, e.g. "Venues (14)"
 * - `info`: node rendered as a small green "Info"-style link beside the title
 * - `actions`: right-aligned button cluster
 */
export const PageHeader = ({
  title,
  description,
  actions,
  breadcrumbs,
  counter,
  info,
  className,
}) => (
  <div className={cn('mb-5', className)}>
    {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-3" /> : null}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-900 leading-tight">{title}</h1>
          {counter !== undefined && counter !== null && (
            <span className="text-lg font-normal text-ink-500">({counter})</span>
          )}
          {info}
        </div>
        {description && <p className="mt-1 text-sm text-ink-500 max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  </div>
);
