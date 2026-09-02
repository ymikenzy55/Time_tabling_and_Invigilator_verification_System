import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';

/** Base shimmer block */
export const Skeleton = ({ className }) => (
  <div className={cn('animate-pulse rounded bg-surface-border/70', className)} />
);

/** Card-shaped skeleton with title + lines */
export const SkeletonCard = ({ lines = 3, className }) => (
  <div className={cn('panel p-5 space-y-3', className)}>
    <Skeleton className="h-4 w-1/2" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn('h-3', i % 2 === 0 ? 'w-full' : 'w-3/4')} />
    ))}
  </div>
);

/** Grid of skeleton cards */
export const SkeletonCardGrid = ({ count = 6, lines = 3, label, className }) => (
  <div className={cn('space-y-3', className)}>
    {label && (
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        {label}
      </div>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  </div>
);

/** Table-shaped skeleton: header row + N body rows */
export const SkeletonTable = ({ rows = 6, cols = 4, label, className }) => (
  <div className={cn('space-y-3', className)}>
    {label && (
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        {label}
      </div>
    )}
    <div className="panel overflow-hidden">
      <div className="border-b border-surface-border bg-surface-subtle px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-surface-divider">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-3', c === 0 ? 'flex-[1.4]' : 'flex-1')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Filter bar skeleton (label + input shapes) */
export const SkeletonFilters = ({ count = 3, className }) => (
  <div className={cn('panel p-4 mb-5 flex flex-wrap items-end gap-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="w-full sm:w-60 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
    ))}
  </div>
);

/** Timetable-specific skeleton: header + dept heading + grid table */
export const SkeletonTimetable = ({ className }) => (
  <div className={cn('space-y-4', className)}>
    <div className="panel p-6 space-y-3">
      <Skeleton className="h-5 w-64 mx-auto" />
      <Skeleton className="h-4 w-48 mx-auto" />
    </div>
    {[0, 1].map((s) => (
      <div key={s} className="panel p-4 space-y-3">
        <Skeleton className="h-4 w-1/3 mx-auto" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-[16%]" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
        {[0, 1, 2].map((r) => (
          <div key={r} className="flex gap-2">
            <Skeleton className="h-16 w-[16%]" />
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
          </div>
        ))}
      </div>
    ))}
  </div>
);
