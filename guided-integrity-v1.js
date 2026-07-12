// Pre-render integrity for guided lesson state and rapid mobile interactions.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const STEP_KEYS = ['word', 'sentence', 'recall', 'script', 'reviews'];
  let ratingLocked = false;

  function readJSON(key, fallback = {}) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? { ...fallback, ...parsed }
        : { ...fallback };
    } catch {
      return { ...fallback };
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function validCard(index) {
    const value = Number(index);
    return Number.isInteger(value) && Boolean(state.cards?.[value]) && Boolean(getWord(value));
  }

  function nextIncomplete(day) {
    const index = STEP_KEYS.findIndex(key => !day.done?.[key]);
    return index < 0 ? 5 : index;
  }

  function sanitizeCardsBeforeGuidedRender() {
    state.cards = state.cards && typeof state.cards === 'object' && !Array.isArray(state.cards)
      ? state.cards
      : {};
    let changed = false;
    Object.keys(state.cards).forEach(key => {
      const index = Number(key);
      if (!Number.isInteger(index) || !getWord(index)) {
        delete state.cards[key];
        changed = true;
      }
    });
    if (changed) saveState();
    return changed;
  }

  function sanitizeGuidedDay() {
    const guided = readJSON(GUIDED_KEY, { days: {} });
    guided.days = guided.days && typeof guided.days === 'object' && !Array.isArray(guided.days)
      ? guided.days
      : {};
    const key = todayKey();
    const day = guided.days[key];
    if (!day || typeof day !== 'object' || Array.isArray(day)) return false;

    const before = JSON.stringify(day);
    day.done = day.done && typeof day.done === 'object' ? day.done : {};
    day.script = day.script && typeof day.script === 'object' ? day.script : {};
    day.reviews = day.reviews && typeof day.reviews === 'object'
      ? day.reviews
      : { queue: [], position: 0, revealed: false };

    const oldQueue = Array.isArray(day.reviews.queue) ? day.reviews.queue.map(Number) : [];
    const rawPosition = Number(day.reviews.position);
    const oldPosition = Number.isInteger(rawPosition)
      ? Math.max(0, Math.min(oldQueue.length, rawPosition))
      : 0;
    const removedBefore = oldQueue.slice(0, oldPosition).filter(index => !validCard(index)).length;
    const queue = oldQueue.filter(validCard);
    const position = Math.max(0, Math.min(queue.length, oldPosition - removedBefore));
    const currentChanged = oldQueue[oldPosition] !== queue[position];
    day.reviews.queue = queue;
    day.reviews.position = position;
    if (currentChanged) day.reviews.revealed = false;
    day.reviews.revealed = Boolean(day.reviews.revealed) && position < queue.length;
    if (position >= queue.length) day.done.reviews = true;

    const script = readJSON(SCRIPT_KEY, { completed: {} });
    const review = readJSON(LETTER_REVIEW_KEY, { daily: {} });
    const standaloneTodayCorrect = Boolean(script.completed?.[key]);
    const externalPastCorrect = Number(review.daily?.[key]?.correct || 0) > 0;
    const todayIndex = dayNumber() % SCRIPT_LESSONS.length;

    if (standaloneTodayCorrect) {
      Object.assign(day.script, {
        studyComplete: true,
        todayAnswered: true,
        todaySelected: todayIndex,
        todayCorrect: true
      });
      localStorage.setItem(`${STUDIED_PREFIX}${key}`, '1');
    }

    const todaySatisfied = Boolean(day.script.todayCorrect || standaloneTodayCorrect);
    const pastSatisfied = day.script.pastIndex === null || day.script.pastIndex === undefined
      || Boolean(day.script.pastCorrect)
      || externalPastCorrect;
    day.done.script = todaySatisfied && pastSatisfied;

    if (!day.done.script) {
      day.completedAt = null;
      if (Number(day.step) > 3 || Number(day.step) === 5) day.step = 3;
      if (todaySatisfied && !pastSatisfied) day.script.phase = 'past';
    }

    const allDone = STEP_KEYS.every(step => Boolean(day.done[step]));
    if (allDone) {
      day.step = 5;
      day.completedAt ||= Date.now();
    } else if (Number(day.step) === 5 || day.done[STEP_KEYS[Number(day.step)]]) {
      day.step = nextIncomplete(day);
    }

    const changed = before !== JSON.stringify(day);
    if (changed) writeJSON(GUIDED_KEY, guided);
    return changed;
  }

  function retryKind() {
    const guided = readJSON(GUIDED_KEY, { days: {} });
    const script = guided.days?.[todayKey()]?.script;
    if (!script) return null;
    if (script.todayAnswered && script.todayCorrect === false) return 'today';
    if (script.phase === 'past' && script.pastAnswered && script.pastCorrect === false) return 'past';
    return null;
  }

  function resetLetterForRetry(kind) {
    const guided = readJSON(GUIDED_KEY, { days: {} });
    const day = guided.days?.[todayKey()];
    if (!day) return false;
    day.done = day.done || {};
    day.script = day.script || {};
    if (kind === 'past') {
      Object.assign(day.script, {
        phase: 'past',
        pastAnswered: false,
        pastSelected: null,
        pastCorrect: false
      });
    } else {
      Object.assign(day.script, {
        studyComplete: true,
        phase: 'today',
        todayAnswered: false,
        todaySelected: null,
        todayCorrect: false
      });
    }
    day.done.script = false;
    day.step = 3;
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

  function decorateRetryButton() {
    const kind = retryKind();
    if (!kind) return;
    const root = document.getElementById('guidedTodayV3');
    const button = root?.querySelector('[data-guided-action="past-letter"], [data-guided-action="continue-reviews"]');
    if (!button) return;
    button.removeAttribute('data-guided-action');
    button.dataset.guidedIntegrityRetry = kind;
    button.textContent = kind === 'past' ? 'Try the older letter again' : 'Try today’s letter again';
  }

  function attachGuidedObserver() {
    const root = document.getElementById('guidedTodayV3');
    if (!root) return;
    const observer = new MutationObserver(decorateRetryButton);
    observer.observe(root, { childList: true, subtree: true });
    decorateRetryButton();
  }

  document.addEventListener('click', event => {
    const retry = event.target.closest('[data-guided-integrity-retry]');
    if (retry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (resetLetterForRetry(retry.dataset.guidedIntegrityRetry)) window.location.reload();
      return;
    }

    const advance = event.target.closest('[data-guided-action="past-letter"], [data-guided-action="continue-reviews"]');
    const kind = advance ? retryKind() : null;
    if (advance && kind) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (resetLetterForRetry(kind)) window.location.reload();
      return;
    }

    const rating = event.target.closest('[data-guided-rate]');
    if (!rating) return;
    if (!currentGuidedReviewIsValid()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sanitizeGuidedDay();
      window.location.reload();
      return;
    }
    if (!acquireRatingLock()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  sanitizeCardsBeforeGuidedRender();
  sanitizeGuidedDay();
  window.setTimeout(() => {
    const changed = sanitizeGuidedDay();
    attachGuidedObserver();
    if (changed && document.getElementById('todayView')?.classList.contains('active')) {
      window.location.reload();
    }
  }, 0);

  if (window.__FARSI_TEST__) {
    window.__FARSI_GUIDED_INTEGRITY_TEST__ = {
      sanitizeCardsBeforeGuidedRender,
      sanitizeGuidedDay,
      retryKind,
      resetLetterForRetry,
      acquireRatingLock,
      currentGuidedReviewIsValid
    };
  }
})();
