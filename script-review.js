// Spaced review for Persian letters introduced on previous days.
(() => {
  const REVIEW_KEY = 'farsi-script-review-v1';
  const REVIEW_WINDOW = Math.min(7, Math.max(0, SCRIPT_LESSONS.length - 1));
  let questionNumber = 0;
  let activeIndex = null;
  let activeDaysAgo = 1;
  let state = loadState();

  function loadState() {
    try {
      return { letters: {}, daily: {}, ...JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') };
    } catch {
      return { letters: {}, daily: {} };
    }
  }

  function saveState() {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(state));
  }

  function shuffle(values) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function todayIndex() {
    return dayNumber() % SCRIPT_LESSONS.length;
  }

  function recentLetters() {
    const current = todayIndex();
    return Array.from({ length: REVIEW_WINDOW }, (_, offset) => ({
      index: (current - offset - 1 + SCRIPT_LESSONS.length) % SCRIPT_LESSONS.length,
      daysAgo: offset + 1
    }));
  }

  function letterStats(index) {
    return { attempts: 0, correct: 0, lastReviewed: 0, ...(state.letters[index] || {}) };
  }

  function chooseLetter() {
    const ranked = recentLetters().map(candidate => {
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

    const best = ranked.slice(0, Math.min(3, ranked.length));
    const available = best.filter(candidate => candidate.index !== activeIndex);
    return (available.length ? available : best)[questionNumber % Math.max(1, (available.length || best.length))];
  }

  function ensureCard() {
    if (document.getElementById('pastScriptReviewCard') || !REVIEW_WINDOW) return;
    const layout = document.querySelector('#scriptView .script-layout');
    if (!layout) return;
    const card = document.createElement('article');
    card.id = 'pastScriptReviewCard';
    card.className = 'script-quiz-card script-review-card';
    card.innerHTML = `
      <div class="script-review-heading">
        <div><p class="eyebrow">REVIEW PREVIOUS LETTERS</p><h3>Keep older letters fresh</h3></div>
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

  function promptFor(lesson, mode) {
    if (mode === 0) return `Which letter makes the “${lesson.sound}” sound?`;
    if (mode === 1) return `Which letter is called “${lesson.name}”?`;
    return `Which letter appears in “${lesson.exampleLatin}” (${lesson.exampleEn})?`;
  }

  function renderQuestion() {
    ensureCard();
    const choiceBox = document.getElementById('pastScriptChoices');
    if (!choiceBox) return;
    const chosen = chooseLetter();
    if (!chosen) return;
    activeIndex = chosen.index;
    activeDaysAgo = chosen.daysAgo;
    const lesson = SCRIPT_LESSONS[activeIndex];
    const mode = questionNumber % 3;
    const recentIndexes = recentLetters().map(item => item.index).filter(index => index !== activeIndex);
    const fallbackIndexes = SCRIPT_LESSONS.map((_, index) => index).filter(index => index !== activeIndex && !recentIndexes.includes(index));
    const distractors = [...shuffle(recentIndexes), ...shuffle(fallbackIndexes)].slice(0, 3);
    const choices = shuffle([activeIndex, ...distractors]);

    document.getElementById('pastScriptContext').textContent = activeDaysAgo === 1 ? 'Yesterday' : `${activeDaysAgo} days ago`;
    document.getElementById('pastScriptPrompt').textContent = promptFor(lesson, mode);
    document.getElementById('pastScriptResult').textContent = '';
    document.getElementById('pastScriptResult').className = 'script-quiz-result';
    document.getElementById('pastScriptAnswerActions').classList.add('hidden');
    choiceBox.innerHTML = '';

    choices.forEach(index => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'script-choice';
      button.textContent = SCRIPT_LESSONS[index].letter;
      button.dataset.pastScriptChoice = String(index);
      button.setAttribute('aria-label', SCRIPT_LESSONS[index].name);
      choiceBox.appendChild(button);
    });
    renderScore();
  }

  function answer(button) {
    const selected = Number(button.dataset.pastScriptChoice);
    const correct = selected === activeIndex;
    const stats = letterStats(activeIndex);
    stats.attempts += 1;
    if (correct) stats.correct += 1;
    stats.lastReviewed = Date.now();
    state.letters[activeIndex] = stats;

    const key = todayKey();
    const daily = { attempts: 0, correct: 0, ...(state.daily[key] || {}) };
    daily.attempts += 1;
    if (correct) daily.correct += 1;
    state.daily[key] = daily;
    saveState();

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
    const daily = { attempts: 0, correct: 0, ...(state.daily[todayKey()] || {}) };
    const score = document.getElementById('pastScriptScore');
    if (!score) return;
    score.textContent = daily.attempts
      ? `${daily.correct} of ${daily.attempts} previous-letter reviews correct today`
      : 'Older letters will return more often when you miss them.';
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
