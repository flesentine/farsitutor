// Spaced review for Persian letters the learner has actually studied.
(() => {
  const REVIEW_KEY = 'farsi-script-review-v1';
  const SCRIPT_KEY = 'farsi-script-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const MAX_RECENT = Math.min(7, Math.max(0, SCRIPT_LESSONS.length - 1));

  let questionNumber = 0;
  let activeIndex = null;
  let activeDaysAgo = null;
  let reviewState = loadReviewState();

  function loadReviewState() {
    try {
      return { letters: {}, daily: {}, ...JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') };
    } catch {
      return { letters: {}, daily: {} };
    }
  }

  function loadScriptState() {
    try {
      return { completed: {}, ...JSON.parse(localStorage.getItem(SCRIPT_KEY) || '{}') };
    } catch {
      return { completed: {} };
    }
  }

  function saveReviewState() {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewState));
  }

  function parseDayKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!match) return null;
    const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isFinite(value) ? Math.floor(value / DAY_MS) : null;
  }

  function curriculumDay() {
    const key = typeof CURRICULUM_START !== 'undefined' ? CURRICULUM_START : '2024-01-01';
    return parseDayKey(key) ?? 0;
  }

  function indexForDayKey(key) {
    const ordinal = parseDayKey(key);
    if (ordinal === null || !SCRIPT_LESSONS.length) return null;
    const offset = ordinal - curriculumDay();
    return ((offset % SCRIPT_LESSONS.length) + SCRIPT_LESSONS.length) % SCRIPT_LESSONS.length;
  }

  function todayIndex() {
    return dayNumber() % SCRIPT_LESSONS.length;
  }

  function studiedDayKeys() {
    const keys = new Set();
    const script = loadScriptState();
    Object.entries(script.completed || {}).forEach(([key, complete]) => {
      if (complete) keys.add(key);
    });
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(STUDIED_PREFIX) && localStorage.getItem(key) === '1') {
        keys.add(key.slice(STUDIED_PREFIX.length));
      }
    }
    return [...keys];
  }

  function studiedCandidates(limit = MAX_RECENT) {
    const todayOrdinal = parseDayKey(todayKey());
    if (todayOrdinal === null) return [];
    const current = todayIndex();
    const mostRecentByIndex = new Map();

    studiedDayKeys().forEach(key => {
      const ordinal = parseDayKey(key);
      const index = indexForDayKey(key);
      if (ordinal === null || index === null || ordinal >= todayOrdinal || index === current) return;
      const daysAgo = todayOrdinal - ordinal;
      const existing = mostRecentByIndex.get(index);
      if (!existing || daysAgo < existing.daysAgo) mostRecentByIndex.set(index, { index, daysAgo, studiedOn: key });
    });

    return [...mostRecentByIndex.values()]
      .sort((a, b) => a.daysAgo - b.daysAgo)
      .slice(0, Math.max(0, limit));
  }

  window.getStudiedScriptCandidates = studiedCandidates;

  function shuffle(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const next = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[next]] = [copy[next], copy[index]];
    }
    return copy;
  }

  function letterStats(index) {
    return { attempts: 0, correct: 0, lastReviewed: 0, ...(reviewState.letters[index] || {}) };
  }

  function chooseLetter() {
    const ranked = studiedCandidates().map(candidate => {
      const stats = letterStats(candidate.index);
      return {
        ...candidate,
        stats,
        accuracy: stats.attempts ? stats.correct / stats.attempts : -1
      };
    }).sort((a, b) => {
      if (a.stats.attempts === 0 && b.stats.attempts !== 0) return -1;
      if (b.stats.attempts === 0 && a.stats.attempts !== 0) return 1;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return a.stats.lastReviewed - b.stats.lastReviewed;
    });

    if (!ranked.length) return null;
    const best = ranked.slice(0, Math.min(3, ranked.length));
    const alternatives = best.filter(candidate => candidate.index !== activeIndex);
    const pool = alternatives.length ? alternatives : best;
    return pool[questionNumber % pool.length];
  }

  function primarySound(sound) {
    return String(sound || '').toLowerCase().split(/[\s/(,]/).filter(Boolean)[0] || '';
  }

  function hasUniqueSound(index) {
    const key = primarySound(SCRIPT_LESSONS[index]?.sound);
    return SCRIPT_LESSONS.filter(lesson => primarySound(lesson.sound) === key).length === 1;
  }

  function questionFor(lesson, requestedMode) {
    if (requestedMode === 0 && hasUniqueSound(activeIndex)) {
      return { type: 'sound', text: `Which letter makes the “${lesson.sound}” sound?` };
    }
    if (requestedMode === 1) {
      return { type: 'name', text: `Which letter is called “${lesson.name}”?` };
    }
    return {
      type: 'example',
      html: `Which letter appears in <span lang="fa" dir="rtl">${escapeHTML(lesson.exampleFa)}</span> (${escapeHTML(lesson.exampleLatin)}, ${escapeHTML(lesson.exampleEn)})?`
    };
  }

  function validDistractor(index, targetIndex, questionType) {
    if (index === targetIndex) return false;
    const target = SCRIPT_LESSONS[targetIndex];
    const candidate = SCRIPT_LESSONS[index];
    if (questionType === 'sound') return primarySound(candidate.sound) !== primarySound(target.sound);
    if (questionType === 'example') return !String(target.exampleFa || '').includes(candidate.letter);
    return true;
  }

  function buildChoices(targetIndex, questionType) {
    const studied = studiedCandidates(SCRIPT_LESSONS.length).map(candidate => candidate.index);
    const all = SCRIPT_LESSONS.map((_, index) => index);
    const pool = [...new Set([...shuffle(studied), ...shuffle(all)])]
      .filter(index => validDistractor(index, targetIndex, questionType));
    return shuffle([targetIndex, ...pool.slice(0, 3)]);
  }

  function ensureCard() {
    if (document.getElementById('pastScriptReviewCard')) return;
    const layout = document.querySelector('#scriptView .script-layout');
    if (!layout) return;
    const card = document.createElement('article');
    card.id = 'pastScriptReviewCard';
    card.className = 'script-quiz-card script-review-card';
    card.innerHTML = `
      <div class="script-review-heading">
        <div><p class="eyebrow">REVIEW STUDIED LETTERS</p><h3>Keep older letters fresh</h3></div>
        <span id="pastScriptContext" class="script-review-context"></span>
      </div>
      <p id="pastScriptPrompt" class="script-review-prompt"></p>
      <div id="pastScriptChoices" class="script-quiz-choices"></div>
      <p id="pastScriptResult" class="script-quiz-result" role="status" aria-live="polite"></p>
      <div id="pastScriptAnswerActions" class="script-review-answer-actions hidden">
        <button id="pastScriptHearBtn" class="sentence-speak-btn" type="button"><span aria-hidden="true">🔊</span> Hear example</button>
        <button id="pastScriptNextBtn" class="secondary-btn" type="button">Review another letter</button>
      </div>
      <p id="pastScriptScore" class="muted script-score"></p>
    `;
    layout.appendChild(card);
    const todayNext = document.getElementById('scriptNextQuizBtn');
    if (todayNext) todayNext.textContent = 'Practice today’s letter again';
  }

  function renderEmptyState() {
    activeIndex = null;
    activeDaysAgo = null;
    const context = document.getElementById('pastScriptContext');
    const prompt = document.getElementById('pastScriptPrompt');
    const choices = document.getElementById('pastScriptChoices');
    const result = document.getElementById('pastScriptResult');
    const actions = document.getElementById('pastScriptAnswerActions');
    if (context) context.textContent = '';
    if (prompt) prompt.textContent = 'No earlier studied letters yet. Complete a letter lesson and it will return on a future day.';
    if (choices) choices.innerHTML = '';
    if (result) result.textContent = '';
    actions?.classList.add('hidden');
    renderScore();
  }

  function renderQuestion() {
    ensureCard();
    const choiceBox = document.getElementById('pastScriptChoices');
    if (!choiceBox) return;
    const chosen = chooseLetter();
    if (!chosen) {
      renderEmptyState();
      return;
    }

    activeIndex = chosen.index;
    activeDaysAgo = chosen.daysAgo;
    const lesson = SCRIPT_LESSONS[activeIndex];
    const question = questionFor(lesson, questionNumber % 3);
    const choices = buildChoices(activeIndex, question.type);

    document.getElementById('pastScriptContext').textContent = activeDaysAgo === 1 ? 'Yesterday' : `${activeDaysAgo} days ago`;
    const prompt = document.getElementById('pastScriptPrompt');
    if (question.html) prompt.innerHTML = question.html;
    else prompt.textContent = question.text;
    document.getElementById('pastScriptResult').textContent = '';
    document.getElementById('pastScriptResult').className = 'script-quiz-result';
    document.getElementById('pastScriptAnswerActions').classList.add('hidden');
    choiceBox.innerHTML = '';

    choices.forEach(index => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'script-choice';
      button.textContent = SCRIPT_LESSONS[index].letter;
      button.lang = 'fa';
      button.dir = 'rtl';
      button.dataset.pastScriptChoice = String(index);
      choiceBox.appendChild(button);
    });
    renderScore();
  }

  function answer(button) {
    if (activeIndex === null) return;
    const selected = Number(button.dataset.pastScriptChoice);
    const correct = selected === activeIndex;
    const stats = letterStats(activeIndex);
    stats.attempts += 1;
    if (correct) stats.correct += 1;
    stats.lastReviewed = Date.now();
    reviewState.letters[activeIndex] = stats;

    const key = todayKey();
    const daily = { attempts: 0, correct: 0, ...(reviewState.daily[key] || {}) };
    daily.attempts += 1;
    if (correct) daily.correct += 1;
    reviewState.daily[key] = daily;
    saveReviewState();

    document.querySelectorAll('[data-past-script-choice]').forEach(choice => {
      choice.disabled = true;
      const index = Number(choice.dataset.pastScriptChoice);
      if (index === activeIndex) choice.classList.add('correct');
      else if (choice === button) choice.classList.add('wrong');
    });

    const lesson = SCRIPT_LESSONS[activeIndex];
    const result = document.getElementById('pastScriptResult');
    result.textContent = correct
      ? `Correct — ${lesson.letter} is ${lesson.name}.`
      : `Not quite. The answer is ${lesson.letter} (${lesson.name}).`;
    result.classList.add(correct ? 'good' : 'bad');
    document.getElementById('pastScriptAnswerActions').classList.remove('hidden');
    renderScore();
  }

  function renderScore() {
    const daily = { attempts: 0, correct: 0, ...(reviewState.daily[todayKey()] || {}) };
    const score = document.getElementById('pastScriptScore');
    if (!score) return;
    score.textContent = daily.attempts
      ? `${daily.correct} of ${daily.attempts} previous-letter reviews correct today`
      : studiedCandidates().length
        ? 'Letters you miss will return more often.'
        : 'Earlier studied letters will appear here on future days.';
  }

  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-past-script-choice]');
    if (choice && !choice.disabled) answer(choice);
    if (event.target.closest('#pastScriptNextBtn')) {
      questionNumber += 1;
      renderQuestion();
    }
    const hear = event.target.closest('#pastScriptHearBtn');
    if (hear && activeIndex !== null) {
      const lesson = SCRIPT_LESSONS[activeIndex];
      speak(lesson.exampleFa, hear, lesson.exampleLatin);
    }
  });

  ensureCard();
  renderQuestion();
})();
