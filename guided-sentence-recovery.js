// Keeps the guided lesson usable when genuine Persian sentence audio fails.
// Also clarifies the lesson's primary audio controls without duplicating practice modes.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const ROOT_ID = 'guidedTodayV3';
  const sentenceActions = new Set(['play-sentence', 'slow-sentence']);

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

  function currentWord() {
    if (typeof window.getWord !== 'function' || typeof window.todaysWordIndex !== 'function') return null;
    return window.getWord(window.todaysWordIndex());
  }

  function makeWordListenButton(word, action, compact = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = compact ? 'guided-word-audio-strip' : 'guided-word-listen';
    button.dataset.guidedAction = action;
    button.setAttribute('aria-label', `Hear the Persian word ${word.fa}, meaning ${word.en}`);

    const farsi = document.createElement('span');
    farsi.className = compact ? 'guided-word-audio-fa' : 'guided-fa';
    farsi.lang = 'fa';
    farsi.dir = 'rtl';
    farsi.textContent = word.fa;

    const label = document.createElement('span');
    label.className = compact ? 'guided-word-audio-label' : 'guided-word-listen-label';
    label.innerHTML = '<span aria-hidden="true">🔊</span> Hear word';

    button.append(farsi, label);
    return button;
  }

  function polishWordCard(card, word) {
    if (card.querySelector('.guided-word-listen')) return;
    const farsi = card.querySelector('.guided-fa');
    if (!farsi) return;

    const listenButton = makeWordListenButton(word, 'play-word');
    farsi.replaceWith(listenButton);

    const duplicateButton = card.querySelector('[data-guided-action="play-word"]:not(.guided-word-listen)');
    duplicateButton?.remove();
  }

  function polishSentenceCard(card, word) {
    card.querySelector('.guided-more')?.remove();

    if (!card.querySelector('.guided-word-audio-strip')) {
      const sentenceButton = card.querySelector('[data-guided-action="play-sentence"]');
      const wordButton = makeWordListenButton(word, 'hear-word-only', true);
      sentenceButton?.before(wordButton);
    }

    const sentenceButton = card.querySelector('[data-guided-action="play-sentence"]');
    if (sentenceButton) {
      const targetLabel = sentenceButton.textContent.includes('again') ? 'Hear sentence again' : 'Hear sentence';
      if (sentenceButton.textContent.trim() !== `🔊 ${targetLabel}`) {
        sentenceButton.innerHTML = `<span aria-hidden="true">🔊</span> ${targetLabel}`;
      }
    }
  }

  function polishGuidedAudioUx() {
    const root = document.getElementById(ROOT_ID);
    const word = currentWord();
    if (!root || !word) return;

    root.querySelectorAll('.guided-plan-item strong').forEach(label => {
      if (label.textContent.trim() === 'Repeat the sentence') label.textContent = 'Hear it in a sentence';
    });

    const activeStep = root.querySelector('.guided-head p:not(.eyebrow)');
    if (activeStep?.textContent.trim() === 'Repeat the sentence') activeStep.textContent = 'Hear it in a sentence';

    root.querySelectorAll('.guided-card').forEach(card => {
      const kicker = card.querySelector('.guided-kicker')?.textContent.trim();
      if (kicker === 'TODAY’S WORD') polishWordCard(card, word);
      if (kicker === 'SENTENCE PRACTICE') polishSentenceCard(card, word);
    });
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

  const observer = new MutationObserver(polishGuidedAudioUx);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', polishGuidedAudioUx, { once: true });
  polishGuidedAudioUx();

  const api = {
    isGuidedSentenceButton,
    markSentencePlayed,
    markSentenceSkipped,
    polishGuidedAudioUx
  };
  window.FarsiSentenceRecovery = api;
  if (window.__FARSI_TEST__) window.__FARSI_SENTENCE_RECOVERY_TEST__ = api;
})();
