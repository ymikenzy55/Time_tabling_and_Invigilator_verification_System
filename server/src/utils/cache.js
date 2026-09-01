const MAX_CACHE_SIZE = 1000; // Maximum number of cache entries
const store = new Map();
const pendingPromises = new Map(); // For cache stampede prevention

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
    // LRU eviction: if cache is full, remove oldest entry
    if (store.size >= MAX_CACHE_SIZE) {
      const firstKey = store.keys().next().value;
      store.delete(firstKey);
    }

    const expiresAt = typeof ttlMs === 'number' && ttlMs > 0
      ? Date.now() + ttlMs
      : null;
    store.set(key, { value, expiresAt });
    return value;
  },

  async remember(key, ttlMs, factory) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    // Cache stampede prevention: if already fetching, wait for existing promise
    if (pendingPromises.has(key)) {
      return pendingPromises.get(key);
    }

    const promise = factory()
      .then((value) => {
        pendingPromises.delete(key);
        return this.set(key, value, ttlMs);
      })
      .catch((error) => {
        pendingPromises.delete(key);
        throw error;
      });

    pendingPromises.set(key, promise);
    return promise;
  },

  clear(key) {
    if (typeof key === 'string') {
      store.delete(key);
      pendingPromises.delete(key);
    } else {
      store.clear();
      pendingPromises.clear();
    }
  },

  clearPrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key);
        pendingPromises.delete(key);
      }
    }
  },

  // Utility to get cache stats for monitoring
  getStats() {
    return {
      size: store.size,
      maxSize: MAX_CACHE_SIZE,
      pendingRequests: pendingPromises.size,
    };
  },
};
