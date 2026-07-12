// Normalize saved guided state before the consolidated Today module initializes.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';

  function read(key, fallback = {}) {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...fallback }; }
  }

  const guided = read(GUIDED_KEY, { days: {} });
  const day = guided.days?.[todayKey()];
  if (!day) return;

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

  const script = read(SCRIPT_KEY, { completed: {} });
  const review = read(LETTER_REVIEW_KEY, { daily: {} });
  const todayEvidence = Boolean(day.script.todayAnswered || script.completed?.[todayKey()]);
  const priorEvidence = !selected || Boolean(day.script.pastAnswered) || Number(review.daily?.[todayKey()]?.attempts || 0) > 0;

  if (day.done.script && (!todayEvidence || !priorEvidence)) {
    day.done.script = false;
    day.completedAt = null;
    if (Number(day.step) > 3) day.step = 3;
  }

  localStorage.setItem(GUIDED_KEY, JSON.stringify(guided));
})();
