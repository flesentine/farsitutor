// Shared runtime boundary for the web app and future Capacitor builds.
(() => {
  const params = new URLSearchParams(window.location.search);
  const forcedMode = params.get('app-platform');
  const capacitor = window.Capacitor;
  const detectedPlatform = typeof capacitor?.getPlatform === 'function'
    ? capacitor.getPlatform()
    : 'web';
  const detectedNative = typeof capacitor?.isNativePlatform === 'function'
    ? capacitor.isNativePlatform()
    : detectedPlatform !== 'web';
  const isNative = forcedMode === 'native'
    ? true
    : forcedMode === 'web'
      ? false
      : detectedNative;
  const platform = isNative && detectedPlatform === 'web'
    ? 'native'
    : (isNative ? detectedPlatform : 'web');

  let adapter = {};

  async function invoke(method, ...args) {
    const handler = adapter[method];
    if (typeof handler !== 'function') return { supported: false };

    try {
      const result = await handler(...args);
      return result ?? { supported: true };
    } catch (error) {
      console.warn(`FarsiPlatform.${method} failed`, error);
      return { supported: false, error };
    }
  }

  const api = {
    platform,
    isNative,
    isWeb: !isNative,
    capabilities: Object.freeze({
      installPrompt: !isNative,
      serviceWorker: !isNative && 'serviceWorker' in navigator,
      share: isNative || typeof navigator.share === 'function',
      haptics: isNative,
      notifications: isNative
    }),

    registerAdapter(nextAdapter = {}) {
      if (!nextAdapter || typeof nextAdapter !== 'object') return;
      adapter = { ...adapter, ...nextAdapter };
      document.dispatchEvent(new CustomEvent('farsi:platform-adapter-ready', {
        detail: { platform }
      }));
    },

    haptic(style = 'light') {
      return invoke('haptic', style);
    },

    scheduleDailyReminder(options = {}) {
      return invoke('scheduleDailyReminder', options);
    },

    cancelDailyReminder() {
      return invoke('cancelDailyReminder');
    },

    async share(payload = {}) {
      if (typeof adapter.share === 'function') return invoke('share', payload);
      if (typeof navigator.share !== 'function') return { supported: false };

      try {
        await navigator.share(payload);
        return { supported: true };
      } catch (error) {
        if (error?.name === 'AbortError') return { supported: true, cancelled: true };
        return { supported: false, error };
      }
    }
  };

  window.FarsiPlatform = Object.freeze(api);
  document.documentElement.dataset.appPlatform = platform;
  document.documentElement.classList.toggle('is-native-app', isNative);
  document.documentElement.classList.toggle('is-web-app', !isNative);
  document.dispatchEvent(new CustomEvent('farsi:platform-ready', {
    detail: { platform, isNative }
  }));
})();
