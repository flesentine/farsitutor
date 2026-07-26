// Inline older-letter review for the completed Today lesson.
(() => {
  const ROOT_ID = 'guidedTodayV3';
  const REVIEW_KEY = 'farsi-script-review-v1';
  const UI_KEY = 'farsi-guided-script-inline-v1';
  let rendering = false;

  const read = (key, fallback = {}) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...fallback, ...value }
        : { ...fallback };
    } catch {
      return { ...fallback };
    }
  };

  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = value => escapeHTML(String(value ?? ''));

  function defaultDayState() {
    return {
      candidateIndex: null,
      candidateDaysAgo: null,
      questionNumber: 0,
      choices: [],
      answered: false,
      selected: null,
      correct: false,
      completed: false,
      skipped: false
    };
  }

  function readUiStore() {
    const store = read(UI_KEY, { days: {} });
    store.days = store.days && typeof store.days === 'object' && !Array.isArray(store.days)
      ? store.days
      : {};
    return store;
  }

  function loadDayState() {
    const store = readUiStore();
    const saved = store.days[todayKey()];
    const state = { ...defaultDayState(), ...(saved && typeof saved === 'object' ? saved : {}) };
    state.choices = Array.isArray(state.choices)
      ? state.choices.map(Number).filter(index => Number.isInteger(index) && SCRIPT_LESSONS[index])
      : [];
    const review = read(REVIEW_KEY, { daily: {} });
    if (!saved && Number(review.daily?.[todayKey()]?.correct || 0) > 0) state.completed = true;
    return state;
  }

  function saveDayState(state) {
    const store = readUiStore();
    store.days[todayKey()] = state;
    write(UI_KEY, store);
  }

  function studiedCandidates() {
    return typeof window.getStudiedScriptCandidates === 'function'
      ? window.getStudiedScriptCandidates(SCRIPT_LESSONS.length)
      : [];
  }

  function letterStats(review, index) {
    return { attempts: 0, correct: 0, lastReviewed: 0, ...(review.letters?.[index] || {}) };
  }

  function rankedCandidates(excludeIndex = null) {
    const review = read(REVIEW_KEY, { letters: {}, daily: {} });
    const candidates = studiedCandidates().map(candidate => {
      const stats = letterStats(review, candidate.index);
      return {
        ...candidate,
        stats,
        accuracy: stats.attempts ? stats.correct / stats.attempts : -1
      };
    }).sort((left, right) => {
      if (left.stats.attempts === 0 && right.stats.attempts !== 0) return -1;
      if (right.stats.attempts === 0 && left.stats.attempts !== 0) return 1;
      if (left.accuracy !== right.accuracy) return left.accuracy - right.accuracy;
      if (left.stats.lastReviewed !== right.stats.lastReviewed) return left.stats.lastReviewed - right.stats.lastReviewed;
      return right.daysAgo - left.daysAgo;
    });
    if (excludeIndex !== null && candidates.length > 1) {
      return candidates.filter(candidate => candidate.index !== Number(excludeIndex));
    }
    return candidates;
  }

  function ensureCandidate(state, excludeIndex = null) {
    const available = rankedCandidates(excludeIndex);
    const preferred = state.candidateIndex == null ? null : Number(state.candidateIndex);
    const current = preferred === null ? null : available.find(candidate => candidate.index === preferred);
    const candidate = current || available[0] || null;
    if (!candidate) return null;
    state.candidateIndex = candidate.index;
    state.candidateDaysAgo = candidate.daysAgo;
    if (!state.choices.length || !state.choices.includes(candidate.index)) {
      const question = window.FarsiScriptQuiz.questionFor(candidate.index, state.questionNumber);
      state.choices = window.FarsiScriptQuiz.buildChoices(candidate.index, question);
    }
    return candidate;
  }

  function recordAnswer(index, correct) {
    const review = read(REVIEW_KEY, { letters: {}, daily: {} });
    review.letters = review.letters && typeof review.letters === 'object' ? review.letters : {};
    review.daily = review.daily && typeof review.daily === 'object' ? review.daily : {};

    const stats = letterStats(review, index);
    stats.attempts += 1;
    if (correct) stats.correct += 1;
    stats.lastReviewed = Date.now();
    review.letters[index] = stats;

    const key = todayKey();
    const daily = { attempts: 0, correct: 0, ...(review.daily[key] || {}) };
    daily.attempts += 1;
    if (correct) daily.correct += 1;
    review.daily[key] = daily;
    write(REVIEW_KEY, review);
  }

  function doneCard() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return null;
    const completionLabels = new Set(['DONE FOR TODAY', 'LESSON COMPLETE']);
    return [...root.querySelectorAll('.guided-card')].find(card =>
      completionLabels.has(card.querySelector('.guided-kicker')?.textContent.trim())
    ) || null;
  }

  function statusMessage(state) {
    if (state.completed) return '✓ Older-letter review complete today.';
    if (state.skipped) return 'Older-letter review skipped for today.';
    return '';
  }

  function reviewPanelHtml(state, candidate) {
    const lesson = SCRIPT_LESSONS[candidate.index];
    const question = window.FarsiScriptQuiz.questionFor(candidate.index, state.questionNumber);
    const context = candidate.daysAgo === 1 ? 'Yesterday' : `${candidate.daysAgo} days ago`;
    const prompt = question.html || esc(question.text);
    const feedback = state.answered
      ? `<p class="guided-feedback ${state.correct ? 'good' : 'bad'}">${state.correct
        ? `Correct — ${esc(lesson.letter)} is ${esc(lesson.name)}.`
        : `Not quite. The answer is ${esc(lesson.letter)} (${esc(lesson.name)}).`}</p>`
      : '';
    const answerActions = state.answered
      ? `<button type="button" class="sentence-speak-btn guided-secondary" data-inline-script-action="hear">🔊 Hear the example word</button>
         <button type="button" class="primary-btn guided-primary" data-inline-script-action="${state.correct ? 'finish' : 'retry'}">${state.correct ? 'Finish for today' : 'Try this letter again'}</button>`
      : '<button type="button" class="secondary-btn guided-secondary" data-inline-script-action="skip">Skip for today</button>';

    return `<section class="guided-inline-script" aria-labelledby="guidedInlineScriptTitle">
      <div class="guided-inline-script-heading">
        <div><span class="guided-kicker">QUICK SCRIPT REVIEW</span><h3 id="guidedInlineScriptTitle">Review one older letter</h3></div>
        <span class="guided-inline-script-context">${esc(context)}</span>
      </div>
      <p class="guided-inline-script-prompt">${prompt}</p>
      <div class="guided-letter-choices">${state.choices.map(index => `
        <button type="button" class="guided-letter-choice${state.answered ? (index === candidate.index ? ' correct' : state.selected === index ? ' wrong' : '') : ''}" data-inline-script-choice="${index}" lang="fa" dir="rtl" ${state.answered ? 'disabled' : ''}>${esc(SCRIPT_LESSONS[index].letter)}</button>`).join('')}</div>
      ${feedback}
      <div class="guided-inline-script-actions">${answerActions}</div>
      <p class="guided-inline-script-help">This uses the same progress and review history as the full Script practice screen.</p>
    </section>`;
  }

  function renderInto(card) {
    if (!card || rendering) return;
    rendering = true;
    try {
      card.querySelector('.guided-inline-script')?.remove();
      card.querySelector('.guided-inline-script-status')?.remove();

      const state = loadDayState();
      const candidates = rankedCandidates();
      const oldButton = card.querySelector('[data-guided-action="extra-letters"], [data-inline-script-start]');

      if (!candidates.length) {
        oldButton?.remove();
        card.dataset.inlineScriptEnhanced = todayKey();
        return;
      }

      if (oldButton) {
        oldButton.removeAttribute('data-guided-action');
        oldButton.dataset.inlineScriptStart = '1';
        oldButton.textContent = state.completed ? 'Review another older letter' : 'Review an older letter';
      }

      const insertBefore = oldButton || card.querySelector('[data-guided-action="play-done-word"]');
      if (!state.completed && !state.skipped) {
        const candidate = ensureCandidate(state);
        if (candidate) {
          saveDayState(state);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = reviewPanelHtml(state, candidate);
          const panel = wrapper.firstElementChild;
          if (insertBefore) card.insertBefore(panel, insertBefore);
          else card.appendChild(panel);
          if (oldButton) oldButton.hidden = true;
        }
      } else {
        if (oldButton) oldButton.hidden = false;
        const message = statusMessage(state);
        if (message) {
          const note = document.createElement('p');
          note.className = 'guided-inline-script-status';
          note.textContent = message;
          if (insertBefore) card.insertBefore(note, insertBefore);
          else card.appendChild(note);
        }
      }
      card.dataset.inlineScriptEnhanced = todayKey();
    } finally {
      rendering = false;
    }
  }

  function refresh() {
    const card = doneCard();
    if (card) renderInto(card);
  }

  function resetForAnother() {
    const previous = loadDayState();
    const state = defaultDayState();
    const candidate = rankedCandidates(previous.candidateIndex)[0] || rankedCandidates()[0] || null;
    if (candidate) {
      state.candidateIndex = candidate.index;
      state.candidateDaysAgo = candidate.daysAgo;
    }
    saveDayState(state);
    renderInto(doneCard());
  }

  async function hearExample(button, state) {
    const lesson = SCRIPT_LESSONS[Number(state.candidateIndex)];
    if (!lesson) return;
    if (typeof window.speakPractice === 'function') {
      await window.speakPractice([{ text: lesson.exampleFa, phoneticHint: lesson.exampleLatin }], button);
    } else if (typeof window.speak === 'function') {
      window.speak(lesson.exampleFa, button, lesson.exampleLatin);
    }
  }

  document.addEventListener('click', async event => {
    if (!event.target.closest(`#${ROOT_ID}`)) return;

    const start = event.target.closest('[data-inline-script-start], [data-guided-action="extra-letters"]');
    if (start) {
      event.preventDefault();
      event.stopPropagation();
      resetForAnother();
      return;
    }

    const choice = event.target.closest('[data-inline-script-choice]');
    if (choice) {
      event.preventDefault();
      event.stopPropagation();
      const state = loadDayState();
      if (state.answered) return;
      const candidate = ensureCandidate(state);
      if (!candidate) return;
      const selected = Number(choice.dataset.inlineScriptChoice);
      const correct = selected === candidate.index;
      Object.assign(state, { answered: true, selected, correct });
      recordAnswer(candidate.index, correct);
      saveDayState(state);
      renderInto(doneCard());
      return;
    }

    const action = event.target.closest('[data-inline-script-action]');
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    const state = loadDayState();

    if (action.dataset.inlineScriptAction === 'hear') {
      await hearExample(action, state);
      return;
    }
    if (action.dataset.inlineScriptAction === 'retry') {
      state.questionNumber = Number(state.questionNumber || 0) + 1;
      state.choices = [];
      state.answered = false;
      state.selected = null;
      state.correct = false;
      saveDayState(state);
      renderInto(doneCard());
      return;
    }
    if (action.dataset.inlineScriptAction === 'finish') {
      state.completed = true;
      state.skipped = false;
      saveDayState(state);
      renderInto(doneCard());
      return;
    }
    if (action.dataset.inlineScriptAction === 'skip') {
      state.skipped = true;
      saveDayState(state);
      renderInto(doneCard());
    }
  }, true);

  const observer = new MutationObserver(() => {
    const card = doneCard();
    if (card && card.dataset.inlineScriptEnhanced !== todayKey()) renderInto(card);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('storage', event => {
    if (![REVIEW_KEY, UI_KEY].includes(event.key)) return;
    const card = doneCard();
    if (card) {
      delete card.dataset.inlineScriptEnhanced;
      renderInto(card);
    }
  });

  document.addEventListener('DOMContentLoaded', refresh, { once: true });
  refresh();
})();
