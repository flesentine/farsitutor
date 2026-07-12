// Pre-render storage validation for the guided lesson.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const STEP_KEYS = ['word', 'sentence', 'recall', 'script', 'reviews'];
  let ratingLocked = false;

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

    const originalQueue = Array.isArray(day.reviews.queue) ? day.reviews.queue.map(Number) : [];
    const rawPosition = Number(day.reviews.position);
    const originalPosition = Number.isInteger(rawPosition) ? Math.max(0, Math.min(originalQueue.length, rawPosition)) : 0;
    const removedBefore = originalQueue.slice(0, originalPosition).filter(index => !validCard(index)).length;
    const queue = originalQueue.filter(validCard);
    const position = Math.max(0, Math.min(queue.length, originalPosition - removedBefore));
    if (originalQueue[originalPosition] !== queue[position]) day.reviews.revealed = false;
    day.reviews.queue = queue;
    day.reviews.position = position;
    day.reviews.revealed = Boolean(day.reviews.revealed) && position < queue.length;
    day.done.reviews = position >= queue.length;

    if (day.recall.answered && day.recall.correct !== true) day.done.recall = false;

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
    const olderSatisfied = day.script.pastIndex == null || Boolean(day.script.pastCorrect) || olderCorrect;
    day.done.script = todaySatisfied && olderSatisfied;
    if (!todaySatisfied) day.script.phase = 'today';
    else if (!olderSatisfied) day.script.phase = 'past';

    const step = Number(day.step);
    const invalidStep = !Number.isInteger(step) || step < 0 || step > 5;
    const allDone = STEP_KEYS.every(name => Boolean(day.done[name]));
    if (allDone) {
      day.step = 5;
      day.completedAt ||= Date.now();
    } else {
      day.completedAt = null;
      if (invalidStep || step === 5 || day.done[STEP_KEYS[step]]) day.step = nextIncomplete(day);
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

  const api = {
    sanitizeCardsBeforeGuidedRender,
    sanitizeGuidedDay,
    retryKind,
    resetLetterForRetry,
    resetRecallForRetry,
    acquireRatingLock,
    currentGuidedReviewIsValid
  };

  window.FarsiGuidedIntegrity = api;
  if (window.__FARSI_TEST__) window.__FARSI_GUIDED_INTEGRITY_TEST__ = api;

  sanitizeCardsBeforeGuidedRender();
  sanitizeGuidedDay();
})();
