import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const Modal = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => setEntered(true), 10);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-ink-900/50 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-white rounded-lg shadow-modal w-full ${sizes[size]} border border-surface-border max-h-[90vh] flex flex-col transition-all duration-200 ${entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-surface-border shrink-0">
          <div className="min-w-0">
            <h3 id="modal-title" className="text-base font-bold text-ink-900 leading-tight">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-md hover:bg-surface-subtle text-ink-500 hover:text-ink-900 shrink-0 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-surface-border flex justify-end gap-2 bg-surface-subtle rounded-b-lg shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
