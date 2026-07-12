// Runtime guards for day rollover, guided-letter completion, and cross-screen state integrity.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const bootDay = todayKey();

  function readGuided() {
    try {
      return { days: {}, ...JSON.parse(localStorage.getItem(GUIDED_KEY) || '{}') };
    } catch {
      return { days: {} };
    }
  }

  function dayState() {
    return readGuided().days?.[todayKey()] || null;
  }

  function todayLetterNeedsRetry() {
    const script = dayState()?.script;
    return Boolean(script?.todayAnswered && script.todayCorrect === false);
  }

  function resetTodayLetterAndReload() {
    const guided = readGuided();
    const key = todayKey();
    const day = guided.days?.[key];
    if (!day) {
      window.location.reload();
      return;
    }

    day.done = day.done || {};
    day.script = day.script || {};
    Object.assign(day.script, {
      studyComplete: true,
      phase: 'today',
      todayAnswered: false,
      todaySelected: null,
      todayCorrect: false
    });
    day.done.script = false;
    day.step = 3;
    day.completedAt = null;
    localStorage.setItem(GUIDED_KEY, JSON.stringify(guided));
    window.location.reload();
  }

  function decorateRetryAction() {
    if (!todayLetterNeedsRetry()) return;
    const root = document.getElementById('guidedTodayV3');
    const advance = root?.querySelector('[data-guided-action="past-letter"], [data-guided-action="continue-reviews"]');
    if (!advance) return;
    advance.removeAttribute('data-guided-action');
    advance.dataset.runtimeAction = 'retry-today-letter';
    advance.textContent = 'Try today’s letter again';
  }

  function checkDayRollover() {
    if (todayKey() !== bootDay) window.location.reload();
  }

  const previousShowView = showView;
  showView = function showViewWithQueueIntegrity(name) {
    if (name === 'review' && typeof sanitizeReviewQueue === 'function') sanitizeReviewQueue();
    previousShowView(name);
    if (name === 'review' && typeof sanitizeReviewQueue === 'function') {
      sanitizeReviewQueue();
      renderReviewCard();
    }
  };

  document.addEventListener('farsi:speech-complete', event => {
    const button = event.detail?.button;
    if (button?.closest('#guidedTodayV3') && button.dataset.guidedAction === 'play-word') {
      addWord(todaysWordIndex(), true);
    }
  });

  document.addEventListener('click', event => {
    const retry = event.target.closest('[data-runtime-action="retry-today-letter"]');
    if (retry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resetTodayLetterAndReload();
      return;
    }

    const advance = event.target.closest('[data-guided-action="past-letter"], [data-guided-action="continue-reviews"]');
    if (advance && todayLetterNeedsRetry()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resetTodayLetterAndReload();
    }
  }, true);

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    sanitizeReviewQueue();
    renderAll();
    if ($('reviewView').classList.contains('active')) renderReviewCard();
  });

  const root = document.getElementById('guidedTodayV3');
  if (root) {
    const observer = new MutationObserver(decorateRetryAction);
    observer.observe(root, { childList: true, subtree: true });
  }

  decorateRetryAction();
  window.addEventListener('focus', checkDayRollover);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDayRollover();
  });
  window.setInterval(checkDayRollover, 60000);
})();
