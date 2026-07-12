// State integrity and answer-safe UX for the guided lesson.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const STEP_KEYS = ['word', 'sentence', 'recall', 'script', 'reviews'];
  let ratingLocked = false;
  let guidedObserver;

  function readJSON(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...fallback, ...value }
        : { ...fallback };
    } catch {
      return { ...fallback };
    }
  }

  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const validCard = index => Number.isInteger(Number(index)) && Boolean(state.cards?.[Number(index)]) && Boolean(getWord(Number(index)));

  function nextIncomplete(day) {
    const index = STEP_KEYS.findIndex(key => !day.done?.[key]);
    return index < 0 ? 5 : index;
  }

  function ensureStylesheet(href, marker) {
    if (document.querySelector(`link[data-${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset[marker] = 'true';
    document.head.appendChild(link);
  }

  function sanitizeCardsBeforeGuidedRender() {
    state.cards = state.cards && typeof state.cards === 'object' && !Array.isArray(state.cards) ? state.cards : {};
    let changed = false;
    Object.keys(state.cards).forEach(key => {
      if (!validCard(key)) {
        delete state.cards[key];
        changed = true;
      }
    });
    if (changed) saveState();
    return changed;
  }

  function sanitizeGuidedDay() {
    const guided = readJSON(GUIDED_KEY, { days: {} });
    guided.days = guided.days && typeof guided.days === 'object' && !Array.isArray(guided.days) ? guided.days : {};
    const key = todayKey();
    const day = guided.days[key];
    if (!day || typeof day !== 'object' || Array.isArray(day)) return false;

    const before = JSON.stringify(day);
    day.done = day.done && typeof day.done === 'object' ? day.done : {};
    day.recall = day.recall && typeof day.recall === 'object' ? day.recall : { answered: false, selected: null, correct: false };
    day.script = day.script && typeof day.script === 'object' ? day.script : {};
    day.reviews = day.reviews && typeof day.reviews === 'object' ? day.reviews : { queue: [], position: 0, revealed: false };

    const oldQueue = Array.isArray(day.reviews.queue) ? day.reviews.queue.map(Number) : [];
    const rawPosition = Number(day.reviews.position);
    const oldPosition = Number.isInteger(rawPosition) ? Math.max(0, Math.min(oldQueue.length, rawPosition)) : 0;
    const removedBefore = oldQueue.slice(0, oldPosition).filter(index => !validCard(index)).length;
    const queue = oldQueue.filter(validCard);
    const position = Math.max(0, Math.min(queue.length, oldPosition - removedBefore));
    if (oldQueue[oldPosition] !== queue[position]) day.reviews.revealed = false;
    day.reviews.queue = queue;
    day.reviews.position = position;
    day.reviews.revealed = Boolean(day.reviews.revealed) && position < queue.length;
    day.done.reviews = position >= queue.length;

    if (day.recall.answered && day.recall.correct === false) {
      day.done.recall = false;
      day.completedAt = null;
      if (Number(day.step) > 2 || Number(day.step) === 5) day.step = 2;
    }

    const script = readJSON(SCRIPT_KEY, { completed: {} });
    const review = readJSON(LETTER_REVIEW_KEY, { daily: {} });
    const todayCorrect = Boolean(script.completed?.[key]);
    const olderCorrect = Number(review.daily?.[key]?.correct || 0) > 0;
    const todayIndex = dayNumber() % SCRIPT_LESSONS.length;
    if (todayCorrect) {
      Object.assign(day.script, { studyComplete: true, todayAnswered: true, todaySelected: todayIndex, todayCorrect: true });
      localStorage.setItem(`${STUDIED_PREFIX}${key}`, '1');
    }
    const todaySatisfied = Boolean(day.script.todayCorrect || todayCorrect);
    const pastSatisfied = day.script.pastIndex == null || Boolean(day.script.pastCorrect) || olderCorrect;
    day.done.script = todaySatisfied && pastSatisfied;
    if (!todaySatisfied) day.script.phase = 'today';
    else if (!pastSatisfied) day.script.phase = 'past';

    const step = Number(day.step);
    if (!Number.isInteger(step) || step < 0 || step > 5) day.step = nextIncomplete(day);
    const allDone = STEP_KEYS.every(name => Boolean(day.done[name]));
    if (allDone) {
      day.step = 5;
      day.completedAt ||= Date.now();
    } else {
      day.completedAt = null;
      if (day.step === 5 || day.done[STEP_KEYS[day.step]]) day.step = nextIncomplete(day);
    }

    const changed = before !== JSON.stringify(day);
    if (changed) writeJSON(GUIDED_KEY, guided);
    return changed;
  }

  function retryKind() {
    const script = readJSON(GUIDED_KEY, { days: {} }).days?.[todayKey()]?.script;
    if (!script) return null;
    if (script.todayAnswered && script.todayCorrect === false) return 'today';
    if (script.phase === 'past' && script.pastAnswered && script.pastCorrect === false) return 'past';
    return null;
  }

  function resetLetterForRetry(kind) {
    const guided = readJSON(GUIDED_KEY, { days: {} });
    const day = guided.days?.[todayKey()];
    if (!day) return false;
    day.done ||= {};
    day.script ||= {};
    if (kind === 'past') {
      Object.assign(day.script, { phase: 'past', pastAnswered: false, pastSelected: null, pastCorrect: false });
    } else {
      Object.assign(day.script, { studyComplete: true, phase: 'today', todayAnswered: false, todaySelected: null, todayCorrect: false });
    }
    day.done.script = false;
    day.step = 3;
    day.completedAt = null;
    writeJSON(GUIDED_KEY, guided);
    return true;
  }

  function resetRecallForRetry() {
    const guided = readJSON(GUIDED_KEY, { days: {} });
    const day = guided.days?.[todayKey()];
    if (!day) return false;
    day.done ||= {};
    day.recall = { answered: false, selected: null, correct: false };
    day.done.recall = false;
    day.step = 2;
    day.completedAt = null;
    writeJSON(GUIDED_KEY, guided);
    return true;
  }

  function acquireRatingLock() {
    if (ratingLocked) return false;
    ratingLocked = true;
    window.setTimeout(() => { ratingLocked = false; }, 400);
    return true;
  }

  function currentGuidedReviewIsValid() {
    const day = readJSON(GUIDED_KEY, { days: {} }).days?.[todayKey()];
    if (!day) return true;
    const queue = Array.isArray(day.reviews?.queue) ? day.reviews.queue : [];
    const position = Number(day.reviews?.position || 0);
    return Number.isInteger(position) && position >= 0 && position < queue.length && validCard(queue[position]);
  }

  function addRecallAudio(card) {
    if (card.querySelector('[data-guided-ux-play-word]')) return;
    const choices = card.querySelector('.guided-choices');
    if (!choices) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-btn guided-audio-cue';
    button.dataset.guidedUxPlayWord = 'true';
    button.textContent = '🔊 Play word';
    choices.before(button);
  }

  function decorateGuidedUI() {
    const root = document.getElementById('guidedTodayV3');
    if (!root) return;
    const plan = root.querySelector('.guided-plan > summary');
    if (plan) plan.textContent = 'See all 5 steps';

    root.querySelectorAll('.guided-inline').forEach(group => {
      const duplicate = group.querySelector('[data-guided-action="play-sentence"]');
      duplicate?.remove();
      const slow = group.querySelector('[data-guided-action="slow-sentence"]');
      if (slow) slow.textContent = 'Play slowly';
      group.classList.toggle('single', group.querySelectorAll('button').length === 1);
    });

    const recall = [...root.querySelectorAll('.guided-card')].find(card => card.querySelector('.guided-choices'));
    if (recall) {
      recall.querySelector('.guided-kicker').textContent = 'LISTENING CHECK';
      const heading = recall.querySelector('h3');
      if (heading) heading.textContent = 'What does the word you just heard mean?';
      recall.querySelector('.guided-latin')?.remove();
      addRecallAudio(recall);
      const day = readJSON(GUIDED_KEY, { days: {} }).days?.[todayKey()];
      if (day?.recall?.answered && !recall.querySelector('.guided-recall-reveal')) {
        const word = getWord(todaysWordIndex());
        const reveal = document.createElement('div');
        reveal.className = 'guided-recall-reveal';
        reveal.innerHTML = `<strong lang="fa" dir="rtl">${escapeHTML(word.fa)}</strong><span>${escapeHTML(word.latin)}</span>`;
        recall.querySelector('.guided-feedback')?.before(reveal);
      }
      if (day?.recall?.answered && day.recall.correct === false) {
        const advance = recall.querySelector('[data-guided-action="continue-script"]');
        if (advance) {
          advance.removeAttribute('data-guided-action');
          advance.dataset.guidedUxRetryRecall = 'true';
          advance.textContent = 'Hear it and try again';
        }
      }
    }

    root.querySelectorAll('[data-guided-action="hear-letter"]').forEach(button => { button.textContent = '🔊 Hear the example word'; });
    const start = root.querySelector('[data-guided-action="start-letter-quiz"]');
    if (start) start.textContent = 'Start letter quiz';
    const extra = root.querySelector('[data-guided-action="extra"]');
    if (extra) extra.textContent = 'Practice more words';

    const kind = retryKind();
    if (kind) {
      const advance = root.querySelector('[data-guided-action="past-letter"], [data-guided-action="continue-reviews"]');
      if (advance) {
        advance.removeAttribute('data-guided-action');
        advance.dataset.guidedIntegrityRetry = kind;
        advance.textContent = 'Try this letter again';
      }
    }
  }

  function observeGuidedUI() {
    const root = document.getElementById('guidedTodayV3');
    if (!root || guidedObserver) return;
    guidedObserver = new MutationObserver(decorateGuidedUI);
    guidedObserver.observe(root, { childList: true, subtree: true });
    decorateGuidedUI();
  }

  document.addEventListener('click', event => {
    const playWord = event.target.closest('[data-guided-ux-play-word]');
    if (playWord) {
      event.preventDefault();
      const word = getWord(todaysWordIndex());
      window.speakPractice([{ text: word.fa, phoneticHint: word.latin }], playWord);
      return;
    }

    const retryRecall = event.target.closest('[data-guided-ux-retry-recall]');
    if (retryRecall) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const word = getWord(todaysWordIndex());
      window.speakPractice([{ text: word.fa, phoneticHint: word.latin }], retryRecall)
        .finally(() => { if (resetRecallForRetry()) window.location.reload(); });
      return;
    }

    const retryLetter = event.target.closest('[data-guided-integrity-retry]');
    if (retryLetter) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (resetLetterForRetry(retryLetter.dataset.guidedIntegrityRetry)) window.location.reload();
      return;
    }

    const rating = event.target.closest('[data-guided-rate]');
    if (rating && (!currentGuidedReviewIsValid() || !acquireRatingLock())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!currentGuidedReviewIsValid()) {
        sanitizeGuidedDay();
        window.location.reload();
      }
    }
  }, true);

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-guided-recall]')) return;
    window.setTimeout(() => {
      const guided = readJSON(GUIDED_KEY, { days: {} });
      const day = guided.days?.[todayKey()];
      if (!day?.recall?.answered || day.recall.correct !== false) return;
      day.done ||= {};
      day.done.recall = false;
      day.step = 2;
      day.completedAt = null;
      writeJSON(GUIDED_KEY, guided);
      if (document.getElementById('todayView')?.classList.contains('active')) window.location.reload();
    }, 0);
  });

  ensureStylesheet('./mobile-experience.css?v=2', 'farsiMobileExperience');
  ensureStylesheet('./guided-usability.css?v=1', 'farsiGuidedUsability');
  sanitizeCardsBeforeGuidedRender();
  sanitizeGuidedDay();
  window.setTimeout(() => {
    sanitizeGuidedDay();
    observeGuidedUI();
    const scriptStart = document.querySelector('[data-script-start]');
    if (scriptStart) scriptStart.textContent = 'Start quiz';
  }, 0);

  if (window.__FARSI_TEST__) {
    window.__FARSI_GUIDED_INTEGRITY_TEST__ = {
      sanitizeCardsBeforeGuidedRender,
      sanitizeGuidedDay,
      retryKind,
      resetLetterForRetry,
      resetRecallForRetry,
      acquireRatingLock,
      currentGuidedReviewIsValid
    };
  }
})();