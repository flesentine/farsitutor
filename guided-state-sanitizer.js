// Normalize saved guided state before the consolidated Today module initializes.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';

  function read(key, fallback = {}) {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...fallback }; }
  }

  const key = todayKey();
  const guided = read(GUIDED_KEY, { days: {} });
  guided.days = guided.days || {};
  const script = read(SCRIPT_KEY, { completed: {} });
  const review = read(LETTER_REVIEW_KEY, { daily: {} });
  const standaloneComplete = Boolean(script.completed?.[key]);
  let day = guided.days[key];

  // There is nothing to migrate until either guided or standalone progress exists.
  if (!day && !standaloneComplete) return;
  if (!day) {
    day = { done: {}, script: {} };
    guided.days[key] = day;
  }

  day.done = day.done || {};
  day.script = day.script || {};
  const candidates = typeof window.getStudiedScriptCandidates === 'function'
    ? window.getStudiedScriptCandidates(SCRIPT_LESSONS.length)
    : [];
  const previousIndex = day.script.pastIndex ?? null;
  const preferred = candidates.find(candidate => candidate.index === Number(previousIndex));
  const selected = preferred || candidates[0] || null;

  if ((selected?.index ?? null) !== previousIndex) {
    day.script.pastIndex = selected?.index ?? null;
    day.script.pastDaysAgo = selected?.daysAgo ?? null;
    day.script.pastAnswered = false;
    day.script.pastSelected = null;
    day.script.pastCorrect = false;
    if (day.script.phase === 'past') day.script.phase = 'today';
  } else if (selected) {
    day.script.pastDaysAgo = selected.daysAgo;
  }

  if (standaloneComplete) {
    const currentIndex = dayNumber() % SCRIPT_LESSONS.length;
    day.script.studyComplete = true;
    day.script.todayAnswered = true;
    day.script.todaySelected = currentIndex;
    day.script.todayCorrect = true;
    localStorage.setItem(`${STUDIED_PREFIX}${key}`, '1');
  }

  const todayEvidence = Boolean(day.script.todayAnswered || standaloneComplete);
  const priorEvidence = !selected || Boolean(day.script.pastAnswered) || Number(review.daily?.[key]?.attempts || 0) > 0;

  if (standaloneComplete && priorEvidence) {
    day.done.script = true;
  } else if (day.done.script && (!todayEvidence || !priorEvidence)) {
    day.done.script = false;
    day.completedAt = null;
    if (Number(day.step) > 3) day.step = 3;
  }

  if (standaloneComplete && selected && !priorEvidence) {
    day.done.script = false;
    day.script.phase = 'past';
    day.completedAt = null;
    if (Number(day.step) > 3) day.step = 3;
  }

  localStorage.setItem(GUIDED_KEY, JSON.stringify(guided));
})();
