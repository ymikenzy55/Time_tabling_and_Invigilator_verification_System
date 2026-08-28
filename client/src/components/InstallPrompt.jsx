import { useEffect, useState, useCallback } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';

const PROMPT_KEY_PREFIX = 'ems:pwaPrompted:';

export const InstallPrompt = () => {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const shouldPrompt = useCallback(() => {
    if (!user) return false;
    const key = `${PROMPT_KEY_PREFIX}${user.id}`;
    return localStorage.getItem(key) !== '1';
  }, [user]);

  useEffect(() => {
    if (!deferredPrompt || !user) return;
    if (!shouldPrompt()) return;
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [deferredPrompt, user, shouldPrompt]);

  const dismiss = useCallback(() => {
    if (user) {
      localStorage.setItem(`${PROMPT_KEY_PREFIX}${user.id}`, '1');
    }
    setOpen(false);
    setDeferredPrompt(null);
  }, [user]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (user) {
        localStorage.setItem(`${PROMPT_KEY_PREFIX}${user.id}`, '1');
      }
      if (outcome === 'accepted') {
        setOpen(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={installing ? undefined : dismiss}
      title="Install App"
      size="sm"
    >
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 grid place-items-center mx-auto mb-4">
          <Download className="w-7 h-7" />
        </div>
        <p className="text-sm text-ink-700 mb-1 font-semibold">
          Install Examination Management System
        </p>
        <p className="text-xs text-ink-500 mb-6">
          Install this app on your device for quick access. It works just like the
          website but launches from your home screen or desktop.
        </p>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex-1"
            onClick={dismiss}
            disabled={installing}
          >
            Maybe later
          </button>
          <button
            className="btn-primary flex-1"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Install
          </button>
        </div>
      </div>
    </Modal>
  );
};
