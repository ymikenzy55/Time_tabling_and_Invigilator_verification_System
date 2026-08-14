import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/**
 * Console-style breadcrumb trail.
 *
 * items: [{ label: 'Examinations', to: '/examinations' }, { label: 'Sessions' }]
 * The final item is always rendered as the (non-link) current page.
 */
export const Breadcrumbs = ({ items = [], className }) => {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('crumbs', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && <span aria-hidden="true" className="text-ink-300">/</span>}
            {isLast || !item.to ? (
              <span className={isLast ? 'crumb-current' : undefined} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link to={item.to} className="crumb-link">{item.label}</Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
};
