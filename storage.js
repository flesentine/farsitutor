// Shared persistence layer for web storage and future native adapters.
(() => {
  const browserStorage = window.localStorage;
  const storagePrototype = Object.getPrototypeOf(browserStorage);
  const raw = {
    getItem: storagePrototype.getItem,
    setItem: storagePrototype.setItem,
    removeItem: storagePrototype.removeItem,
    clear: storagePrototype.clear,
    key: storagePrototype.key
  };
  const LEARNING_PREFIX = 'farsi-';
  let nativeAdapter = null;
  let writeQueue = Promise.resolve();

  const browser = {
    getItem(key) {
      return raw.getItem.call(browserStorage, String(key));
    },
    setItem(key, value) {
      raw.setItem.call(browserStorage, String(key), String(value));
    },
    removeItem(key) {
      raw.removeItem.call(browserStorage, String(key));
    },
    clear() {
      raw.clear.call(browserStorage);
    },
    key(index) {
      return raw.key.call(browserStorage, Number(index));
    },
    keys(prefix = '') {
      const matches = [];
      for (let index = 0; index < browserStorage.length; index += 1) {
        const key = raw.key.call(browserStorage, index);
        if (key !== null && String(key).startsWith(prefix)) matches.push(key);
      }
      return matches;
    }
  };

  function enqueueNative(method, ...args) {
    const handler = nativeAdapter?.[method];
    if (typeof handler !== 'function') return;
    writeQueue = writeQueue
      .then(() => handler(...args))
      .catch(error => console.warn(`FarsiStorage.${method} failed`, error));
  }

  function normalizeEntries(value) {
    if (!value) return {};
    if (value instanceof Map) return Object.fromEntries(value.entries());
    if (Array.isArray(value)) return Object.fromEntries(value);
    return typeof value === 'object' ? value : {};
  }

  const api = {
    learningPrefix: LEARNING_PREFIX,

    getItem(key) {
      return browser.getItem(key);
    },

    setItem(key, value) {
      const normalizedKey = String(key);
      const normalizedValue = String(value);
      browser.setItem(normalizedKey, normalizedValue);
      enqueueNative('setItem', normalizedKey, normalizedValue);
    },

    removeItem(key) {
      const normalizedKey = String(key);
      browser.removeItem(normalizedKey);
      enqueueNative('removeItem', normalizedKey);
    },

    clear() {
      browser.clear();
      enqueueNative('clear');
    },

    key(index) {
      return browser.key(index);
    },

    keys(prefix = '') {
      return browser.keys(String(prefix));
    },

    get length() {
      return browserStorage.length;
    },

    readJSON(key, fallback = null) {
      try {
        const stored = api.getItem(key);
        return stored === null ? fallback : JSON.parse(stored);
      } catch {
        return fallback;
      }
    },

    writeJSON(key, value) {
      api.setItem(key, JSON.stringify(value));
    },

    clearLearningData() {
      api.keys(LEARNING_PREFIX).forEach(key => api.removeItem(key));
    },

    exportLearningData() {
      return Object.fromEntries(api.keys(LEARNING_PREFIX).map(key => [key, api.getItem(key)]));
    },

    async registerAdapter(adapter, options = {}) {
      nativeAdapter = adapter && typeof adapter === 'object' ? adapter : null;
      if (!nativeAdapter) return { registered: false };

      const hydrate = options.hydrate !== false;
      if (hydrate) await api.hydrateFromAdapter();
      document.dispatchEvent(new CustomEvent('farsi:storage-adapter-ready'));
      return { registered: true };
    },

    async hydrateFromAdapter() {
      if (!nativeAdapter) return { hydrated: false };
      const loadAll = nativeAdapter.loadAll;
      if (typeof loadAll !== 'function') return { hydrated: false };

      const incoming = normalizeEntries(await loadAll());
      const nativeKeys = Object.keys(incoming).filter(key => key.startsWith(LEARNING_PREFIX));

      if (nativeKeys.length) {
        nativeKeys.forEach(key => browser.setItem(key, incoming[key]));
        document.dispatchEvent(new CustomEvent('farsi:storage-hydrated', {
          detail: { source: 'native', count: nativeKeys.length }
        }));
        return { hydrated: true, source: 'native', count: nativeKeys.length };
      }

      const existing = api.exportLearningData();
      for (const [key, value] of Object.entries(existing)) {
        if (typeof nativeAdapter.setItem === 'function') await nativeAdapter.setItem(key, value);
      }
      document.dispatchEvent(new CustomEvent('farsi:storage-hydrated', {
        detail: { source: 'browser', count: Object.keys(existing).length }
      }));
      return { hydrated: true, source: 'browser', count: Object.keys(existing).length };
    },

    flush() {
      return writeQueue;
    }
  };

  // Preserve older modules that still call localStorage directly. Their calls are
  // routed through this adapter while migration to explicit FarsiStorage calls continues.
  try {
    Object.defineProperties(storagePrototype, {
      getItem: {
        configurable: true,
        writable: true,
        value(key) {
          return this === browserStorage ? api.getItem(key) : raw.getItem.call(this, key);
        }
      },
      setItem: {
        configurable: true,
        writable: true,
        value(key, value) {
          return this === browserStorage ? api.setItem(key, value) : raw.setItem.call(this, key, value);
        }
      },
      removeItem: {
        configurable: true,
        writable: true,
        value(key) {
          return this === browserStorage ? api.removeItem(key) : raw.removeItem.call(this, key);
        }
      },
      clear: {
        configurable: true,
        writable: true,
        value() {
          return this === browserStorage ? api.clear() : raw.clear.call(this);
        }
      },
      key: {
        configurable: true,
        writable: true,
        value(index) {
          return this === browserStorage ? api.key(index) : raw.key.call(this, index);
        }
      }
    });
  } catch (error) {
    console.warn('FarsiStorage compatibility bridge could not be installed', error);
  }

  window.FarsiStorage = api;
  document.dispatchEvent(new CustomEvent('farsi:storage-ready'));
})();
