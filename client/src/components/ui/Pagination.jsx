import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const Pagination = ({ page, totalPages, total, pageSize, onPageChange }) => {
  if (!total || total <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const goTo = (p) => {
    if (p >= 1 && p <= totalPages) onPageChange(p);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-divider text-sm">
      <div className="text-ink-500">
        Showing <span className="font-medium text-ink-700">{start}–{end}</span> of <span className="font-medium text-ink-700">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          className="p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => goTo(1)}
          disabled={page === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => goTo(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {getPageNumbers(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-ink-400">…</span>
          ) : (
            <button
              key={p}
              className={`min-w-[32px] h-8 rounded-md text-sm font-medium ${
                p === page
                  ? 'bg-primary-600 text-white'
                  : 'text-ink-700 hover:bg-surface-subtle'
              }`}
              onClick={() => goTo(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className="p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => goTo(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => goTo(totalPages)}
          disabled={page === totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
};
