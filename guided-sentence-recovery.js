// Keeps the guided lesson usable when genuine Persian sentence audio fails.
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

  function updateSentence(mutator) {
    const store = readStore();
    store.days = store.days && typeof store.days === 'object' && !Array.isArray(store.days) ? store.days : {};
    const day = store.days[todayKey()];
    if (!day) return false;
    day.done = day.done && typeof day.done === 'object' ? day.done : {};
    mutator(day);
    day.completedAt = null;
    localStorage.setItem(GUIDED_KEY, JSON.stringify(store));
    window.FarsiGuidedToday?.reloadFromStorage?.();
    return true;
  }

  function markSentencePlayed() {
    return updateSentence(day => {
      day.sentencePlayed = true;
      day.sentenceSkipped = false;
    });
  }

  function markSentenceSkipped() {
    return updateSentence(day => {
      day.done.sentence = true;
      day.sentencePlayed = false;
      day.sentenceSkipped = true;
      day.step = 2;
    });
  }

  function isGuidedSentenceButton(button) {
    return Boolean(button?.closest?.(`#${ROOT_ID}`) && sentenceActions.has(button.dataset?.guidedAction));
  }

  function showRecovery(button) {
    if (!isGuidedSentenceButton(button)) return;
    const card = button.closest('.guided-card');
    if (!card || card.querySelector('[data-retry-persian-audio]')) return;
    const panel = document.createElement('div');
    panel.className = 'guided-audio-recovery';
    panel.innerHTML = `
      <p><strong>Real Persian audio is not ready yet.</strong><br>Try it again, or keep going without audio.</p>
      <button type="button" class="primary-btn guided-primary" data-retry-persian-audio>🔊 Try Persian audio again</button>
      <button type="button" class="secondary-btn guided-secondary" data-skip-sentence-audio>Continue without audio</button>`;
    card.appendChild(panel);
  }

  document.addEventListener('farsi:speech-error', event => showRecovery(event.detail?.button));
  document.addEventListener('click', async event => {
    const retry = event.target.closest('[data-retry-persian-audio]');
    if (retry) {
      const card = retry.closest('.guided-card');
      const text = card?.querySelector('.guided-sentence')?.textContent?.trim();
      const ok = await window.FarsiSentenceAudio?.playPersian?.(text, retry);
      if (ok) markSentencePlayed();
      return;
    }
    if (event.target.closest('[data-skip-sentence-audio]')) markSentenceSkipped();
  });

  const api = { isGuidedSentenceButton, markSentencePlayed, markSentenceSkipped };
  window.FarsiSentenceRecovery = api;
  if (window.__FARSI_TEST__) window.__FARSI_SENTENCE_RECOVERY_TEST__ = api;
})();
