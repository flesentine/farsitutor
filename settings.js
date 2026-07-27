// User preferences and the in-app Settings, Privacy, Support, and About screen.
(() => {
  const SETTINGS_KEY = 'farsi-settings-v1';
  const APP_VERSION = window.FARSI_APP_VERSION || '1.0.0-pre-release';
  const defaults = {
    audioSpeed: 'normal',
    reminderEnabled: false,
    reminderTime: '19:00'
  };

  function normalize(value = {}) {
    const audioSpeed = value.audioSpeed === 'slow' ? 'slow' : 'normal';
    const reminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value.reminderTime || ''))
      ? String(value.reminderTime)
      : defaults.reminderTime;
    return {
      audioSpeed,
      reminderEnabled: Boolean(value.reminderEnabled),
      reminderTime
    };
  }

  let settings = normalize(window.FarsiStorage?.readJSON(SETTINGS_KEY, defaults));
  let previousLearningView = document.querySelector('.tab.active')?.dataset.view || 'today';

  function save() {
    window.FarsiStorage?.writeJSON(SETTINGS_KEY, settings);
    document.dispatchEvent(new CustomEvent('farsi:settings-changed', {
      detail: { ...settings }
    }));
  }

  function setStatus(message = '', isError = false) {
    const status = document.getElementById('settingsStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function reminderParts() {
    const [hour, minute] = settings.reminderTime.split(':').map(Number);
    return { hour, minute };
  }

  async function syncReminder() {
    if (!window.FarsiPlatform?.isNative) return { supported: false };
    const result = settings.reminderEnabled
      ? await window.FarsiPlatform.scheduleDailyReminder({
          ...reminderParts(),
          title: 'Your daily Farsi lesson is ready',
          body: 'Learn one useful word and one Persian letter.'
        })
      : await window.FarsiPlatform.cancelDailyReminder();
    return result || { supported: false };
  }

  function render() {
    const speed = document.getElementById('audioSpeedSelect');
    const reminder = document.getElementById('reminderEnabled');
    const reminderTime = document.getElementById('reminderTime');
    const nativeReminderAvailable = Boolean(window.FarsiPlatform?.isNative);

    if (speed) speed.value = settings.audioSpeed;
    if (reminder) {
      reminder.checked = settings.reminderEnabled;
      reminder.disabled = !nativeReminderAvailable;
    }
    if (reminderTime) {
      reminderTime.value = settings.reminderTime;
      reminderTime.disabled = !nativeReminderAvailable || !settings.reminderEnabled;
    }

    const reminderHelp = document.getElementById('reminderHelp');
    if (reminderHelp) {
      reminderHelp.textContent = nativeReminderAvailable
        ? 'Uses an on-device notification. The native notification adapter is connected during the Xcode step.'
        : 'Daily reminders become available in the iPhone app.';
    }

    const version = document.getElementById('appVersionValue');
    if (version) version.textContent = APP_VERSION;
    const platform = document.getElementById('appPlatformValue');
    if (platform) platform.textContent = window.FarsiPlatform?.platform || 'web';
  }

  const api = {
    get audioSpeed() {
      return settings.audioSpeed;
    },
    get reminderEnabled() {
      return settings.reminderEnabled;
    },
    get reminderTime() {
      return settings.reminderTime;
    },
    get version() {
      return APP_VERSION;
    },
    snapshot() {
      return { ...settings };
    }
  };
  window.FarsiSettings = Object.freeze(api);

  const baseShowView = showView;
  showView = function showViewWithSettings(name) {
    if (name !== 'settings') previousLearningView = name;
    baseShowView(name);
    if (name === 'settings') {
      render();
      window.setTimeout(() => document.getElementById('settingsHeading')?.focus(), 0);
    }
  };

  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    previousLearningView = document.querySelector('.tab.active')?.dataset.view || previousLearningView;
    showView('settings');
  });

  document.getElementById('settingsBackBtn')?.addEventListener('click', () => {
    showView(previousLearningView || 'today');
    document.querySelector(`.tab[data-view="${previousLearningView}"]`)?.focus();
  });

  document.getElementById('audioSpeedSelect')?.addEventListener('change', event => {
    settings.audioSpeed = event.currentTarget.value === 'slow' ? 'slow' : 'normal';
    save();
    setStatus(`Pronunciation speed set to ${settings.audioSpeed === 'slow' ? 'slower' : 'normal'}.`);
  });

  document.getElementById('reminderEnabled')?.addEventListener('change', async event => {
    const checkbox = event.currentTarget;
    settings.reminderEnabled = checkbox.checked;
    document.getElementById('reminderTime').disabled = !settings.reminderEnabled;
    const result = await syncReminder();
    if (result.supported === false) {
      settings.reminderEnabled = false;
      checkbox.checked = false;
      document.getElementById('reminderTime').disabled = true;
      setStatus('Daily reminders will be activated during the Xcode notification step.', true);
      return;
    }
    save();
    setStatus(settings.reminderEnabled ? 'Daily reminder scheduled.' : 'Daily reminder turned off.');
  });

  document.getElementById('reminderTime')?.addEventListener('change', async event => {
    settings.reminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(event.currentTarget.value)
      ? event.currentTarget.value
      : defaults.reminderTime;
    if (settings.reminderEnabled) {
      const result = await syncReminder();
      if (result.supported === false) {
        setStatus('The reminder time is saved, but native notifications are not connected yet.', true);
      }
    }
    save();
  });

  document.getElementById('privacyFooterBtn')?.addEventListener('click', () => {
    previousLearningView = document.querySelector('.tab.active')?.dataset.view || previousLearningView;
    showView('settings');
    window.setTimeout(() => document.getElementById('privacySettingsCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  });

  document.getElementById('copyDiagnosticsBtn')?.addEventListener('click', async () => {
    const details = [
      `Farsi Daily ${APP_VERSION}`,
      `Platform: ${window.FarsiPlatform?.platform || 'web'}`,
      `Saved words: ${Object.keys(window.state?.cards || state?.cards || {}).length}`,
      `Learning storage keys: ${window.FarsiStorage?.keys('farsi-').length || 0}`,
      `User agent: ${navigator.userAgent}`
    ].join('\n');
    try {
      await navigator.clipboard.writeText(details);
      setStatus('App details copied.');
    } catch {
      setStatus('Could not copy automatically. Open the support page for troubleshooting steps.', true);
    }
  });

  window.addEventListener('storage', event => {
    if (event.key !== SETTINGS_KEY) return;
    settings = normalize(window.FarsiStorage?.readJSON(SETTINGS_KEY, defaults));
    render();
  });

  render();
})();
