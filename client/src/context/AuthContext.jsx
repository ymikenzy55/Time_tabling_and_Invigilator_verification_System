import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api, tokenStore, onAuthError } from '@/lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // React to 401s from any API call — immediately clear user state so the UI
  // doesn't show a stale "logged in" view while the token is dead.
  useEffect(() => onAuthError(() => {
    setUser(null);
    setLoading(false);
  }), []);

  const login = useCallback(async ({ email, password }) => {
    const res = await api.post('/auth/login', { email, password });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    refresh: loadMe,
  }), [user, loading, login, logout, loadMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
