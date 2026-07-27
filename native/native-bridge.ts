import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';

const LEARNING_PREFIX = 'farsi-';
const DAILY_REMINDER_ID = 42001;
const appScripts = Array.isArray(window.__FARSI_NATIVE_APP_SCRIPTS__)
  ? window.__FARSI_NATIVE_APP_SCRIPTS__
  : [];

function learningKey(key: string): boolean {
  return String(key).startsWith(LEARNING_PREFIX);
}

const storageAdapter = {
  async loadAll(): Promise<Record<string, string>> {
    const { keys } = await Preferences.keys();
    const entries: Record<string, string> = {};
    await Promise.all(keys.filter(learningKey).map(async key => {
      const { value } = await Preferences.get({ key });
      if (value !== null) entries[key] = value;
    }));
    return entries;
  },

  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key: String(key), value: String(value) });
  },

  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key: String(key) });
  },

  async clear(): Promise<void> {
    const { keys } = await Preferences.keys();
    await Promise.all(keys.filter(learningKey).map(key => Preferences.remove({ key })));
  }
};

function impactStyle(style: string): ImpactStyle {
  if (style === 'heavy') return ImpactStyle.Heavy;
  if (style === 'medium') return ImpactStyle.Medium;
  return ImpactStyle.Light;
}

async function haptic(style = 'light') {
  const normalized = String(style).toLowerCase();
  if (normalized === 'success') {
    await Haptics.notification({ type: NotificationType.Success });
  } else if (normalized === 'warning') {
    await Haptics.notification({ type: NotificationType.Warning });
  } else if (normalized === 'error') {
    await Haptics.notification({ type: NotificationType.Error });
  } else {
    await Haptics.impact({ style: impactStyle(normalized) });
  }
  return { supported: true };
}

async function notificationPermission(): Promise<boolean> {
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
    permission = await LocalNotifications.requestPermissions();
  }
  return permission.display === 'granted';
}

async function cancelDailyReminder() {
  await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
  return { supported: true, cancelled: true };
}

async function scheduleDailyReminder(options: Record<string, unknown> = {}) {
  const granted = await notificationPermission();
  if (!granted) return { supported: false, granted: false, scheduled: false, reason: 'permission-denied' };

  const hour = Math.min(23, Math.max(0, Number(options.hour) || 19));
  const minute = Math.min(59, Math.max(0, Number(options.minute) || 0));
  await cancelDailyReminder();
  await LocalNotifications.schedule({
    notifications: [{
      id: DAILY_REMINDER_ID,
      title: String(options.title || 'Your daily Farsi lesson is ready'),
      body: String(options.body || 'Learn one useful word and one Persian letter.'),
      schedule: { on: { hour, minute, second: 0 } },
      extra: { source: 'farsi-daily', destination: 'today' }
    }]
  });
  return { supported: true, granted: true, scheduled: true, hour, minute };
}

async function share(payload: Record<string, unknown> = {}) {
  const availability = await Share.canShare();
  if (!availability.value) return { supported: false };
  const result = await Share.share({
    title: payload.title ? String(payload.title) : undefined,
    text: payload.text ? String(payload.text) : undefined,
    url: payload.url ? String(payload.url) : undefined,
    dialogTitle: payload.dialogTitle ? String(payload.dialogTitle) : undefined
  });
  return { supported: true, activityType: result.activityType || '' };
}

function loadScript(source: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error(`Could not load ${source}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function startAppScripts(): Promise<void> {
  for (const source of appScripts) await loadScript(source);
}

async function bootstrap(): Promise<void> {
  let storageHydration: Record<string, unknown> = { hydrated: false };
  let error: unknown = null;

  try {
    if (!Capacitor.isNativePlatform()) throw new Error('Native bridge loaded outside a Capacitor runtime.');
    window.FarsiPlatform?.registerAdapter({ haptic, scheduleDailyReminder, cancelDailyReminder, share });
    storageHydration = await window.FarsiStorage?.registerAdapter(storageAdapter) || storageHydration;
  } catch (caught) {
    error = caught;
    console.error('Farsi Daily native bootstrap failed; continuing with the web fallback.', caught);
  }

  try {
    await startAppScripts();
  } finally {
    window.FarsiNative = Object.freeze({
      ready: true,
      platform: Capacitor.getPlatform(),
      storageHydration,
      error
    });
    document.dispatchEvent(new CustomEvent('farsi:native-ready', {
      detail: { platform: Capacitor.getPlatform(), storageHydration, error: Boolean(error) }
    }));
  }
}

void bootstrap();
