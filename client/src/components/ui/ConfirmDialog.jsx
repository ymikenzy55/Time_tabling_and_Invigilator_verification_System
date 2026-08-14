import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

/**
 * ConfirmDialog: presentational confirmation modal.
 *
 * Also exports a ConfirmProvider + useConfirm() hook for imperative usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title, description, confirmText, tone });
 *   if (ok) doThing();
 */

const toneStyles = {
  danger: {
    icon: 'bg-rose-50 text-rose-700 border border-rose-200',
    btn: 'btn-danger-solid',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-700 border border-amber-200',
    btn: 'btn btn-md bg-amber-600 border-amber-600 text-white hover:bg-amber-700',
  },
  primary: {
    icon: 'bg-primary-50 text-primary-700 border border-primary-200',
    btn: 'btn-primary',
  },
};

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'danger',
  loading = false,
}) => {
  const styles = toneStyles[tone] || toneStyles.danger;

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="btn-neutral"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={styles.btn}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${styles.icon}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm text-ink-700 leading-relaxed">
          {description || 'Please confirm this action to continue.'}
        </p>
      </div>
    </Modal>
  );
};

// -------------- Imperative API --------------

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, loading: false });

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setState({ open: true, opts, resolve, loading: false });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (state.loading) return;
    state.resolve?.(false);
    setState({ open: false, loading: false });
  }, [state.loading, state.resolve]);

  const handleConfirm = useCallback(async () => {
    const asyncAction = state.opts?.onConfirmAsync;
    const syncAction = state.opts?.onConfirm;
    if (asyncAction) {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        await asyncAction();
        state.resolve?.(true);
      } catch {
        state.resolve?.(false);
      } finally {
        setState({ open: false, loading: false });
      }
    } else {
      if (typeof syncAction === 'function') syncAction();
      state.resolve?.(true);
      setState({ open: false, loading: false });
    }
  }, [state.opts, state.resolve]);

  useEffect(() => () => state.resolve?.(false), []); // eslint-disable-line

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        loading={state.loading}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={state.opts?.title}
        description={state.opts?.description}
        confirmText={state.opts?.confirmText}
        cancelText={state.opts?.cancelText}
        tone={state.opts?.tone}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};
