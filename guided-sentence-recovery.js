// Keeps the guided lesson usable when every sentence-audio method fails.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const ROOT_ID = 'guidedTodayV3';
  const sentenceActions = new Set(['play-sentence', 'slow-sentence', 'repeat-sentence', 'word-sentence']);

  function readStore() {
    try {
      const value = JSON.parse(localStorage.getItem(GUIDED_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : { days: {} };
    } catch {
      return { days: {} };
    }
  }

  function markSentenceSkipped() {
    const store = readStore();
    store.days = store.days && typeof store.days === 'object' && !Array.isArray(store.days) ? store.days : {};
    const day = store.days[todayKey()];
    if (!day) return false;
    day.done = day.done && typeof day.done === 'object' ? day.done : {};
    day.done.sentence = true;
    day.sentencePlayed = false;
    day.sentenceSkipped = true;
    day.step = 2;
    day.completedAt = null;
    localStorage.setItem(GUIDED_KEY, JSON.stringify(store));
    window.FarsiGuidedToday?.reloadFromStorage?.();
    return true;
  }

  function isGuidedSentenceButton(button) {
    return Boolean(button?.closest?.(`#${ROOT_ID}`) && sentenceActions.has(button.dataset?.guidedAction));
  }

  function showRecovery(button) {
    if (!isGuidedSentenceButton(button)) return;
    const card = button.closest('.guided-card');
    if (!card || card.querySelector('[data-skip-sentence-audio]')) return;
    const panel = document.createElement('div');
    panel.className = 'guided-audio-recovery';
    panel.innerHTML = `
      <p><strong>Audio is unavailable on this device right now.</strong><br>You can keep learning and try it again later.</p>
      <button type="button" class="secondary-btn guided-secondary" data-skip-sentence-audio>Continue without audio</button>`;
    card.appendChild(panel);
  }

  document.addEventListener('farsi:speech-error', event => showRecovery(event.detail?.button));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-skip-sentence-audio]')) markSentenceSkipped();
  });

  const api = { isGuidedSentenceButton, markSentenceSkipped };
  window.FarsiSentenceRecovery = api;
  if (window.__FARSI_TEST__) window.__FARSI_SENTENCE_RECOVERY_TEST__ = api;
})();