// Spaced review for Persian letters the learner has actually studied.
(() => {
  const REVIEW_KEY = 'farsi-script-review-v1';
  let questionNumber = 0;
  let activeIndex = null;
  let activeDaysAgo = null;
  let retryIndex = null;
  let lastAnswerCorrect = null;
  let reviewState = loadReviewState();

  function loadReviewState() {
    try {
      return { letters: {}, daily: {}, ...JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') };
    } catch {
      return { letters: {}, daily: {} };
    }
  }

  function refreshReviewState() {
    reviewState = loadReviewState();
    return reviewState;
  }

  function saveReviewState() {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewState));
  }

  function studiedCandidates(limit = 7) {
    return window.FarsiScriptQuiz.studiedCandidates(limit);
  }

  function letterStats(index) {
    return { attempts: 0, correct: 0, lastReviewed: 0, ...(reviewState.letters[index] || {}) };
  }

  function chooseLetter(preferredIndex = null) {
    refreshReviewState();
    const ranked = studiedCandidates().map(candidate => {
      const stats = letterStats(candidate.index);
      return {
        ...candidate,
        stats,
        accuracy: stats.attempts ? stats.correct / stats.attempts : -1
      };
    }).sort((left, right) => {
      if (left.stats.attempts === 0 && right.stats.attempts !== 0) return -1;
      if (right.stats.attempts === 0 && left.stats.attempts !== 0) return 1;
      if (left.accuracy !== right.accuracy) return left.accuracy - right.accuracy;
      return left.stats.lastReviewed - right.stats.lastReviewed;
    });

    if (!ranked.length) return null;
    if (preferredIndex !== null) {
      const preferred = ranked.find(candidate => candidate.index === Number(preferredIndex));
      if (preferred) return preferred;
    }
    const best = ranked.slice(0, Math.min(3, ranked.length));
    const alternatives = best.filter(candidate => candidate.index !== activeIndex);
    const pool = alternatives.length ? alternatives : best;
    return pool[questionNumber % pool.length];
  }

  function ensureCard() {
    if (document.getElementById('pastScriptReviewCard')) return;
    const layout = document.querySelector('#scriptView .script-layout');
    if (!layout) return;
    const card = document.createElement('details');
    card.id = 'pastScriptReviewCard';
    card.className = 'script-review-card';
    card.innerHTML = `
      <summary class="script-review-summary">
        <div class="script-review-summary-copy">
          <p class="eyebrow">OPTIONAL PRACTICE</p>
          <h3>Review older letters</h3>
          <p>Practice letters from earlier lessons when you want extra review.</p>
        </div>
        <span class="script-review-summary-action">Open review</span>
      </summary>
      <div class="script-quiz-card script-review-panel">
        <div class="script-review-heading">
          <div><p class="eyebrow">OLDER LETTER REVIEW</p><h3>Keep earlier letters fresh</h3></div>
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
      </div>
    `;
    card.addEventListener('toggle', () => {
      const action = card.querySelector('.script-review-summary-action');
      if (action) action.textContent = card.open ? 'Close review' : 'Open review';
    });
    layout.appendChild(card);
  }

  function renderEmptyState() {
    activeIndex = null;
    activeDaysAgo = null;
    const context = document.getElementById('pastScriptContext');
    const prompt = document.getElementById('pastScriptPrompt');
    const choices = document.getElementById('pastScriptChoices');
    const result = document.getElementById('pastScriptResult');
    if (context) context.textContent = '';
    if (prompt) prompt.textContent = 'No earlier studied letters yet. Complete a letter lesson and it will return on a future day.';
    if (choices) choices.innerHTML = '';
    if (result) result.textContent = '';
    document.getElementById('pastScriptAnswerActions')?.classList.add('hidden');
    renderScore();
  }

  function renderQuestion() {
    ensureCard();
    const choiceBox = document.getElementById('pastScriptChoices');
    if (!choiceBox) return;
    const chosen = chooseLetter(retryIndex);
    retryIndex = null;
    lastAnswerCorrect = null;
    if (!chosen) {
      renderEmptyState();
      return;
    }

    activeIndex = chosen.index;
    activeDaysAgo = chosen.daysAgo;
    const question = window.FarsiScriptQuiz.questionFor(activeIndex, questionNumber);
    const choices = window.FarsiScriptQuiz.buildChoices(activeIndex, question);

    document.getElementById('pastScriptContext').textContent = activeDaysAgo === 1 ? 'Yesterday' : `${activeDaysAgo} days ago`;
    const prompt = document.getElementById('pastScriptPrompt');
    if (question.html) prompt.innerHTML = question.html;
    else prompt.textContent = question.text;
    const result = document.getElementById('pastScriptResult');
    result.textContent = '';
    result.className = 'script-quiz-result';
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
    refreshReviewState();
    const selected = Number(button.dataset.pastScriptChoice);
    const correct = selected === activeIndex;
    lastAnswerCorrect = correct;
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
    const next = document.getElementById('pastScriptNextBtn');
    next.textContent = correct ? 'Review another letter' : 'Try this letter again';
    document.getElementById('pastScriptAnswerActions').classList.remove('hidden');
    renderScore();
  }

  function renderScore() {
    refreshReviewState();
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
      if (lastAnswerCorrect === false) retryIndex = activeIndex;
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
