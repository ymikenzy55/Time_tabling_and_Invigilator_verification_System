const store = new Map();

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },

  set(key, value, ttlMs) {
    const expiresAt = typeof ttlMs === 'number' && ttlMs > 0
      ? Date.now() + ttlMs
      : null;
    store.set(key, { value, expiresAt });
    return value;
  },

  async remember(key, ttlMs, factory) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const value = await factory();
    return this.set(key, value, ttlMs);
  },

  clear(key) {
    if (typeof key === 'string') {
      store.delete(key);
    } else {
      store.clear();
    }
  },
};
