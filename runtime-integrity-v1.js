// Runtime guards for day rollover, guided progress coordination, and stored-state integrity.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const STEP_KEYS = ['word', 'sentence', 'recall', 'script', 'reviews'];
  const bootDay = todayKey();
  let guidedStateDirty = false;

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

  function readGuided() {
    return readJSON(GUIDED_KEY, { days: {} });
  }

  function finiteNumber(value, fallback, minimum = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum ? number : fallback;
  }

  function normalizeCard(rawCard) {
    const current = rawCard && typeof rawCard === 'object' && !Array.isArray(rawCard) ? rawCard : {};
    const addedAt = finiteNumber(current.addedAt, now());
    const dueAt = finiteNumber(current.dueAt, addedAt + DAY_MS);
    const lastReviewedAt = current.lastReviewedAt === null
      ? null
      : finiteNumber(current.lastReviewedAt, null);
    return {
      ...current,
      addedAt,
      dueAt,
      intervalDays: finiteNumber(current.intervalDays, 0),
      streak: finiteNumber(current.streak, 0),
      good: finiteNumber(current.good, 0),
      bad: finiteNumber(current.bad, 0),
      lastResult: current.lastResult === 'good' || current.lastResult === 'bad' ? current.lastResult : null,
      lastReviewedAt
    };
  }

  function sanitizeStoredCards() {
    state.cards = state.cards && typeof state.cards === 'object' && !Array.isArray(state.cards)
      ? state.cards
      : {};
    let changed = false;
    Object.keys(state.cards).forEach(key => {
      const index = Number(key);
      if (!Number.isInteger(index) || !getWord(index)) {
        delete state.cards[key];
        changed = true;
        return;
      }
      const normalized = normalizeCard(state.cards[key]);
      if (JSON.stringify(normalized) !== JSON.stringify(state.cards[key])) {
        state.cards[key] = normalized;
        changed = true;
      }
    });
    if (changed) saveState();
    return changed;
  }

  function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  function nextIncomplete(day) {
    const index = STEP_KEYS.findIndex(key => !day.done?.[key]);
    return index < 0 ? 5 : index;
  }

  function validCard(index) {
    const value = Number(index);
    return Number.isInteger(value) && Boolean(state.cards?.[value]) && Boolean(getWord(value));
  }

  function syncGuidedDayFromExternalActivity() {
    const guided = readGuided();
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

    const script = readJSON(SCRIPT_KEY, { completed: {} });
    const letterReview = readJSON(LETTER_REVIEW_KEY, { daily: {} });
    const todayLetter = dayNumber() % SCRIPT_LESSONS.length;
    const standaloneTodayCorrect = Boolean(script.completed?.[key]);

    if (standaloneTodayCorrect) {
      Object.assign(day.script, {
        studyComplete: true,
        todayAnswered: true,
        todaySelected: todayLetter,
        todayCorrect: true
      });
      localStorage.setItem(`${STUDIED_PREFIX}${key}`, '1');
    }

    const externalPastCorrect = finiteNumber(letterReview.daily?.[key]?.correct, 0) > 0;
    if (externalPastCorrect) day.script.pastSatisfiedExternally = true;
    else delete day.script.pastSatisfiedExternally;

    const todaySatisfied = Boolean(day.script.todayCorrect || standaloneTodayCorrect);
    const pastSatisfied = day.script.pastIndex === null || day.script.pastIndex === undefined
      || Boolean(day.script.pastCorrect)
      || externalPastCorrect;
    day.done.script = todaySatisfied && pastSatisfied;

    if (!todaySatisfied) day.script.phase = 'today';
    else if (!pastSatisfied) day.script.phase = 'past';

    const queue = Array.isArray(day.reviews.queue) ? day.reviews.queue.map(Number) : [];
    const rawPosition = Number(day.reviews.position);
    const originalPosition = Number.isInteger(rawPosition)
      ? Math.max(0, Math.min(queue.length, rawPosition))
      : 0;
    const processed = queue.slice(0, originalPosition).filter(validCard);
    const remaining = queue.slice(originalPosition).filter(index => {
      if (!validCard(index)) return false;
      const reviewedAt = finiteNumber(state.cards[index]?.lastReviewedAt, 0);
      return reviewedAt < startOfToday();
    });
    const nextQueue = [...processed, ...remaining];
    const currentChanged = queue[originalPosition] !== nextQueue[processed.length];
    day.reviews.queue = nextQueue;
    day.reviews.position = processed.length;
    if (currentChanged) day.reviews.revealed = false;
    day.reviews.revealed = Boolean(day.reviews.revealed) && day.reviews.position < day.reviews.queue.length;
    day.done.reviews = day.reviews.position >= day.reviews.queue.length;

    const allDone = STEP_KEYS.every(step => Boolean(day.done[step]));
    const currentStep = Number(day.step);
    if (allDone) {
      day.step = 5;
      day.completedAt ||= Date.now();
    } else {
      day.completedAt = null;
      const invalidStep = !Number.isInteger(currentStep) || currentStep < 0 || currentStep > 5;
      const currentDone = currentStep >= 0 && currentStep < STEP_KEYS.length && day.done[STEP_KEYS[currentStep]];
      if (invalidStep || currentStep === 5 || currentDone) day.step = nextIncomplete(day);
    }

    const changed = before !== JSON.stringify(day);
    if (changed) writeJSON(GUIDED_KEY, guided);
    return changed;
  }

  function syncTabSemantics() {
    const tablist = document.querySelector('.tabbar');
    if (tablist) tablist.setAttribute('role', 'tablist');
    document.querySelectorAll('.tab[data-view]').forEach(tab => {
      const viewName = tab.dataset.view;
      const panel = document.getElementById(`${viewName}View`);
      const id = `tab-${viewName}`;
      tab.id = id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panel?.id || `${viewName}View`);
      tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
      tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
      if (panel) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', id);
      }
    });
  }

  function checkDayRollover() {
    if (todayKey() !== bootDay) window.location.reload();
  }

  function todayIsActive() {
    return Boolean(document.getElementById('todayView')?.classList.contains('active'));
  }

  sanitizeStoredCards();

  const previousShowView = showView;
  showView = function showViewWithStateIntegrity(name) {
    const guidedChanged = name === 'today' && syncGuidedDayFromExternalActivity();
    if (name === 'today' && (guidedStateDirty || guidedChanged)) {
      window.location.reload();
      return;
    }
    if (name === 'review' && typeof sanitizeReviewQueue === 'function') sanitizeReviewQueue();
    previousShowView(name);
    if (name === 'review' && typeof sanitizeReviewQueue === 'function') {
      sanitizeReviewQueue();
      renderReviewCard();
    }
    syncTabSemantics();
  };

  document.addEventListener('farsi:speech-complete', event => {
    const button = event.detail?.button;
    if (button?.closest('#guidedTodayV3') && button.dataset.guidedAction === 'play-word') {
      addWord(todaysWordIndex(), true);
    }
  });

  document.querySelector('.tabbar')?.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll('.tab[data-view]')];
    const current = Math.max(0, tabs.indexOf(document.activeElement));
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  });

  window.addEventListener('storage', event => {
    const relevantKeys = [STORAGE_KEY, GUIDED_KEY, SCRIPT_KEY, LETTER_REVIEW_KEY];
    if (!relevantKeys.includes(event.key)) return;

    if (event.key === STORAGE_KEY) {
      state = loadState();
      sanitizeStoredCards();
      if (typeof sanitizeReviewQueue === 'function') sanitizeReviewQueue();
      renderAll();
      if (document.getElementById('reviewView')?.classList.contains('active')) renderReviewCard();
    }

    const guidedChanged = event.key !== GUIDED_KEY && syncGuidedDayFromExternalActivity();
    if (event.key === GUIDED_KEY || guidedChanged) guidedStateDirty = true;
    if (todayIsActive() && guidedStateDirty) {
      window.location.reload();
      return;
    }
    syncTabSemantics();
  });

  if (window.__FARSI_TEST__) {
    window.__FARSI_RUNTIME_TEST__ = {
      normalizeCard,
      sanitizeStoredCards,
      syncGuidedDayFromExternalActivity
    };
  }

  syncTabSemantics();
  window.addEventListener('focus', checkDayRollover);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDayRollover();
  });
  window.setInterval(checkDayRollover, 60000);
})();
