import { cn } from '@/lib/cn';

/**
 * Console container: hairline border, optional bordered header row with
 * title / description / actions, optional footer for form buttons.
 *
 * <Panel title="Files and folders" counter={0} actions={<button className="btn-secondary btn-sm">Add</button>}>
 *   …
 * </Panel>
 */
export const Panel = ({
  title,
  description,
  counter,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  /** Set when the body is a table or list that should sit flush against the border. */
  flush = false,
}) => (
  <section className={cn('panel', className)}>
    {(title || actions) && (
      <header className="panel-header">
        <div className="min-w-0">
          {title && (
            <h2 className="panel-title">
              {title}
              {counter !== undefined && counter !== null && (
                <span className="ml-1.5 font-normal text-ink-500">({counter})</span>
              )}
            </h2>
          )}
          {description && <p className="panel-desc">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
    )}
    <div className={cn(flush ? '' : 'panel-body', bodyClassName)}>{children}</div>
    {footer && <footer className="panel-footer">{footer}</footer>}
  </section>
);
