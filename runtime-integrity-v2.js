// Runtime coordination for day rollover, stored cards, tabs, and guided progress.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const STEP_KEYS = ['word', 'sentence', 'recall', 'script', 'reviews'];
  const bootDay = todayKey();

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

  function finiteNumber(value, fallback, minimum = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum ? number : fallback;
  }

  function normalizeCard(rawCard) {
    const current = rawCard && typeof rawCard === 'object' && !Array.isArray(rawCard) ? rawCard : {};
    const addedAt = finiteNumber(current.addedAt, now());
    return {
      ...current,
      addedAt,
      dueAt: finiteNumber(current.dueAt, addedAt + DAY_MS),
      intervalDays: finiteNumber(current.intervalDays, 0),
      streak: finiteNumber(current.streak, 0),
      good: finiteNumber(current.good, 0),
      bad: finiteNumber(current.bad, 0),
      lastResult: ['good', 'bad'].includes(current.lastResult) ? current.lastResult : null,
      lastReviewedAt: current.lastReviewedAt == null ? null : finiteNumber(current.lastReviewedAt, null)
    };
  }

  function sanitizeStoredCards() {
    state.cards = state.cards && typeof state.cards === 'object' && !Array.isArray(state.cards) ? state.cards : {};
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

  function nextIncomplete(day) {
    const index = STEP_KEYS.findIndex(key => !day.done?.[key]);
    return index < 0 ? 5 : index;
  }

  const validCard = index => Number.isInteger(Number(index)) && Boolean(state.cards?.[Number(index)]) && Boolean(getWord(Number(index)));

  function syncGuidedDayFromExternalActivity() {
    const guided = readJSON(GUIDED_KEY, { days: {} });
    guided.days = guided.days && typeof guided.days === 'object' && !Array.isArray(guided.days) ? guided.days : {};
    const key = todayKey();
    const day = guided.days[key];
    if (!day || typeof day !== 'object' || Array.isArray(day)) return false;

    const before = JSON.stringify(day);
    day.done = day.done && typeof day.done === 'object' ? day.done : {};
    day.script = day.script && typeof day.script === 'object' ? day.script : {};
    day.reviews = day.reviews && typeof day.reviews === 'object' ? day.reviews : { queue: [], position: 0, revealed: false };

    const script = readJSON(SCRIPT_KEY, { completed: {} });
    const letterReview = readJSON(LETTER_REVIEW_KEY, { daily: {} });
    const todayLetter = dayNumber() % SCRIPT_LESSONS.length;
    const todayCorrect = Boolean(script.completed?.[key]);
    if (todayCorrect) {
      Object.assign(day.script, { studyComplete: true, todayAnswered: true, todaySelected: todayLetter, todayCorrect: true });
      localStorage.setItem(`${STUDIED_PREFIX}${key}`, '1');
    }

    const olderCorrect = finiteNumber(letterReview.daily?.[key]?.correct, 0) > 0;
    const todaySatisfied = Boolean(day.script.todayCorrect || todayCorrect);
    const olderSatisfied = day.script.pastIndex == null || Boolean(day.script.pastCorrect) || olderCorrect;
    day.done.script = todaySatisfied && olderSatisfied;
    if (!todaySatisfied) day.script.phase = 'today';
    else if (!olderSatisfied) day.script.phase = 'past';

    const queue = Array.isArray(day.reviews.queue) ? day.reviews.queue.map(Number) : [];
    const rawPosition = Number(day.reviews.position);
    const position = Number.isInteger(rawPosition) ? Math.max(0, Math.min(queue.length, rawPosition)) : 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const processed = queue.slice(0, position).filter(validCard);
    const remaining = queue.slice(position).filter(index => validCard(index) && finiteNumber(state.cards[index]?.lastReviewedAt, 0) < start.getTime());
    const nextQueue = [...processed, ...remaining];
    if (queue[position] !== nextQueue[processed.length]) day.reviews.revealed = false;
    day.reviews.queue = nextQueue;
    day.reviews.position = processed.length;
    day.reviews.revealed = Boolean(day.reviews.revealed) && day.reviews.position < nextQueue.length;
    day.done.reviews = day.reviews.position >= nextQueue.length;

    const allDone = STEP_KEYS.every(step => Boolean(day.done[step]));
    const step = Number(day.step);
    if (allDone) {
      day.step = 5;
      day.completedAt ||= Date.now();
    } else {
      day.completedAt = null;
      const invalid = !Number.isInteger(step) || step < 0 || step > 5;
      if (invalid || step === 5 || day.done[STEP_KEYS[step]]) day.step = nextIncomplete(day);
    }

    const changed = before !== JSON.stringify(day);
    if (changed) writeJSON(GUIDED_KEY, guided);
    return changed;
  }

  function syncTabSemantics() {
    document.querySelector('.tabbar')?.setAttribute('role', 'tablist');
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

  function refreshGuidedIfNeeded() {
    const changed = syncGuidedDayFromExternalActivity();
    if (changed || document.getElementById('todayView')?.classList.contains('active')) {
      window.FarsiGuidedToday?.reloadFromStorage?.();
    }
  }

  function checkDayRollover() {
    if (todayKey() !== bootDay) window.location.reload();
  }

  sanitizeStoredCards();

  const previousShowView = showView;
  showView = function showViewWithStateIntegrity(name) {
    if (name === 'today') syncGuidedDayFromExternalActivity();
    previousShowView(name);
    if (name === 'today') window.FarsiGuidedToday?.reloadFromStorage?.();
    syncTabSemantics();
  };

  document.addEventListener('farsi:speech-complete', event => {
    const button = event.detail?.button;
    if (button?.closest('#guidedTodayV3') && button.dataset.guidedAction === 'play-word') addWord(todaysWordIndex(), true);
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
    const relevant = [STORAGE_KEY, GUIDED_KEY, SCRIPT_KEY, LETTER_REVIEW_KEY];
    if (!relevant.includes(event.key)) return;
    if (event.key === STORAGE_KEY) {
      state = loadState();
      sanitizeStoredCards();
      sanitizeReviewQueue();
      renderAll();
      if (document.getElementById('reviewView')?.classList.contains('active')) renderReviewCard();
    }
    refreshGuidedIfNeeded();
    syncTabSemantics();
  });

  if (window.__FARSI_TEST__) {
    window.__FARSI_RUNTIME_TEST__ = { normalizeCard, sanitizeStoredCards, syncGuidedDayFromExternalActivity };
  }

  syncTabSemantics();
  window.addEventListener('focus', checkDayRollover);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDayRollover(); });
  window.setInterval(checkDayRollover, 60000);
})();
