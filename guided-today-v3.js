// Consolidated guided Today lesson with explicit state and no answer-leak overlays.
(() => {
  const KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const STEP_KEYS = ['word', 'sentence', 'recall', 'script', 'reviews'];

  const read = (key, fallback = {}) => {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...fallback }; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = value => escapeHTML(value);
  const currentWord = () => getWord(todaysWordIndex());
  const todayLetterIndex = () => dayNumber() % SCRIPT_LESSONS.length;

  function practiceSentence(word) {
    if (word.exFa) return { fa: word.exFa, latin: word.exLatin || '', en: word.exEn || '' };
    return {
      fa: `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`,
      latin: `Man kalame-ye “${word.latin}” râ yâd migiram.`,
      en: `I am learning the Persian word for “${word.en}.”`
    };
  }

  function primarySound(sound) {
    return String(sound || '').toLowerCase().split(/[\s/(,]/).filter(Boolean)[0] || '';
  }

  function hasUniqueSound(index) {
    const sound = primarySound(SCRIPT_LESSONS[index]?.sound);
    return SCRIPT_LESSONS.filter(lesson => primarySound(lesson.sound) === sound).length === 1;
  }

  function letterReviewState() {
    return read(LETTER_REVIEW_KEY, { letters: {}, daily: {} });
  }

  function studiedCandidates() {
    return typeof window.getStudiedScriptCandidates === 'function'
      ? window.getStudiedScriptCandidates(SCRIPT_LESSONS.length)
      : [];
  }

  function rankPastCandidates() {
    const review = letterReviewState();
    return studiedCandidates().map(candidate => {
      const stats = { attempts: 0, correct: 0, lastReviewed: 0, ...(review.letters?.[candidate.index] || {}) };
      return {
        ...candidate,
        stats,
        accuracy: stats.attempts ? stats.correct / stats.attempts : -1
      };
    }).sort((a, b) => {
      if (a.stats.attempts === 0 && b.stats.attempts !== 0) return -1;
      if (b.stats.attempts === 0 && a.stats.attempts !== 0) return 1;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (a.stats.lastReviewed !== b.stats.lastReviewed) return a.stats.lastReviewed - b.stats.lastReviewed;
      return a.daysAgo - b.daysAgo;
    });
  }

  function choosePastCandidate(preferredIndex = null) {
    const ranked = rankPastCandidates();
    if (preferredIndex !== null) {
      const preferred = ranked.find(candidate => candidate.index === Number(preferredIndex));
      if (preferred) return preferred;
    }
    return ranked[0] || null;
  }

  function dueReviewQueue() {
    return dueCardIndexes().slice(0, 4);
  }

  function freshDayState() {
    const legacy = read('farsi-daily-guided-v1', {})[todayKey()] || {};
    const script = read(SCRIPT_KEY, { completed: {} });
    const review = letterReviewState();
    const past = choosePastCandidate();
    const reviews = dueReviewQueue();
    const todayScriptComplete = Boolean(script.completed?.[todayKey()]);
    const pastReviewComplete = !past || Number(review.daily?.[todayKey()]?.attempts || 0) > 0;
    const done = {
      word: Boolean(legacy.wordHeard),
      sentence: Boolean(legacy.sentenceHeard),
      recall: false,
      script: todayScriptComplete && pastReviewComplete,
      reviews: reviews.length === 0
    };
    const step = STEP_KEYS.findIndex(key => !done[key]);
    return {
      step: step < 0 ? 5 : step,
      done,
      sentencePlayed: done.sentence,
      recall: { answered: false, selected: null, correct: false },
      script: {
        studyComplete: localStorage.getItem(`${STUDIED_PREFIX}${todayKey()}`) === '1',
        phase: 'today',
        todayAnswered: false,
        todaySelected: null,
        todayCorrect: false,
        pastIndex: past?.index ?? null,
        pastDaysAgo: past?.daysAgo ?? null,
        pastAnswered: false,
        pastSelected: null,
        pastCorrect: false
      },
      reviews: { queue: reviews, position: 0, revealed: false },
      completedAt: null
    };
  }

  const store = read(KEY, { days: {} });
  store.days = store.days || {};
  const defaults = freshDayState();
  const saved = store.days[todayKey()] || {};
  let lesson = {
    ...defaults,
    ...saved,
    done: { ...defaults.done, ...(saved.done || {}) },
    recall: { ...defaults.recall, ...(saved.recall || {}) },
    script: { ...defaults.script, ...(saved.script || {}) },
    reviews: { ...defaults.reviews, ...(saved.reviews || {}) }
  };

  const validPast = choosePastCandidate(lesson.script.pastIndex);
  lesson.script.pastIndex = validPast?.index ?? null;
  lesson.script.pastDaysAgo = validPast?.daysAgo ?? null;
  lesson.script.studyComplete = Boolean(
    lesson.script.studyComplete ||
    lesson.script.todayAnswered ||
    localStorage.getItem(`${STUDIED_PREFIX}${todayKey()}`) === '1'
  );
  lesson.reviews.queue = (lesson.reviews.queue || []).filter(index => state.cards[index]);
  lesson.reviews.position = Math.min(Number(lesson.reviews.position || 0), lesson.reviews.queue.length);
  if (!lesson.reviews.queue.length || lesson.reviews.position >= lesson.reviews.queue.length) lesson.done.reviews = true;

  const priorAttempted = Number(letterReviewState().daily?.[todayKey()]?.attempts || 0) > 0;
  if (lesson.done.script && lesson.script.pastIndex !== null && !lesson.script.pastAnswered && !priorAttempted) {
    lesson.done.script = false;
    lesson.completedAt = null;
    if (lesson.step > 3) lesson.step = 3;
  }

  function save() {
    store.days[todayKey()] = lesson;
    write(KEY, store);
  }

  function completedCount() {
    return STEP_KEYS.filter(key => lesson.done[key]).length;
  }

  function nextIncomplete() {
    const index = STEP_KEYS.findIndex(key => !lesson.done[key]);
    return index < 0 ? 5 : index;
  }

  function scriptStepLabel() {
    return lesson.script.pastIndex === null ? 'Practice today’s letter' : 'Practice two letters';
  }

  function stepLabel(index) {
    return [
      'Hear today’s word',
      'Repeat the sentence',
      'Quick meaning check',
      scriptStepLabel(),
      'Review due words'
    ][index];
  }

  function shell() {
    let root = document.getElementById('guidedTodayV3');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'guidedTodayV3';
    root.className = 'guided-today';
    document.getElementById('todayView')?.prepend(root);
    const tab = document.querySelector('.tab[data-view="today"]');
    if (tab) tab.textContent = 'Today';
    return root;
  }

  function planHtml() {
    return `<details class="guided-plan"><summary>View today’s plan</summary><div class="guided-plan-list">${STEP_KEYS.map((key, index) => `
      <button type="button" class="guided-plan-item${lesson.done[key] ? ' done' : ''}${lesson.step === index ? ' active' : ''}" data-guided-jump="${index}" ${lesson.step === index ? 'aria-current="step"' : ''}>
        <span>${lesson.done[key] ? '✓' : index + 1}</span>
        <strong>${esc(stepLabel(index))}</strong>
        <small>${lesson.done[key] ? 'Complete' : lesson.step === index ? 'Current step' : 'Open step'}</small>
      </button>`).join('')}</div></details>`;
  }

  function headerHtml() {
    const complete = completedCount();
    const finished = lesson.step === 5;
    return `
      <header class="guided-head">
        <div><p class="eyebrow">TODAY’S LESSON</p><h2>${finished ? 'Daily lesson complete' : `Step ${lesson.step + 1} of 5`}</h2><p>${finished ? 'Everything required for today is saved.' : esc(stepLabel(lesson.step))}</p></div>
        <strong class="guided-count" aria-label="${complete} of 5 activities complete">${complete}/5</strong>
      </header>
      <div class="guided-bar" role="progressbar" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${complete}"><span style="width:${complete * 20}%"></span></div>
      ${planHtml()}`;
  }

  function overallProgressHtml() {
    const attempts = state.totalGood + state.totalBad;
    return `<details class="guided-progress"><summary>Overall progress</summary><div class="guided-stats">
      <div><strong>${streakDays()}</strong><span>day streak</span></div>
      <div><strong>${Object.keys(state.cards).length}</strong><span>words saved</span></div>
      <div><strong>${dueCardIndexes().length}</strong><span>due now</span></div>
      <div><strong>${attempts ? `${Math.round(state.totalGood / attempts * 100)}%` : '—'}</strong><span>review success</span></div>
    </div></details>`;
  }

  function deterministicShuffle(values, seedOffset = 0) {
    return [...values].sort((left, right) => {
      const leftHash = (((left + 3) * 1103515245 + dayNumber() + seedOffset) >>> 0);
      const rightHash = (((right + 3) * 1103515245 + dayNumber() + seedOffset) >>> 0);
      return leftHash - rightHash;
    });
  }

  function recallChoices() {
    const correct = todaysWordIndex();
    const values = [correct];
    let offset = 7 + dayNumber() % 11;
    while (values.length < 3 && values.length < WORDS.length) {
      const index = (correct + offset) % WORDS.length;
      if (!values.includes(index) && getWord(index).en !== currentWord().en) values.push(index);
      offset += 13;
    }
    return deterministicShuffle(values, 17);
  }

  function letterQuestionType(index) {
    return hasUniqueSound(index) ? 'sound' : 'name';
  }

  function letterChoices(correctIndex, type) {
    const target = SCRIPT_LESSONS[correctIndex];
    const candidates = SCRIPT_LESSONS.map((_, index) => index).filter(index => {
      if (index === correctIndex) return false;
      if (type === 'sound') return primarySound(SCRIPT_LESSONS[index].sound) !== primarySound(target.sound);
      return true;
    });
    return deterministicShuffle([correctIndex, ...deterministicShuffle(candidates, correctIndex).slice(0, 3)], correctIndex + 31);
  }

  function wordCard() {
    const word = currentWord();
    return `<article class="guided-card">
      <span class="guided-kicker">TODAY’S WORD</span>
      <div class="guided-fa" lang="fa" dir="rtl">${esc(word.fa)}</div>
      <div class="guided-latin">${esc(word.latin)}</div>
      <div class="guided-meaning">${esc(word.en)}</div>
      <button type="button" class="primary-btn guided-primary" data-guided-action="play-word">🔊 ${lesson.done.word ? 'Play word again' : 'Hear today’s word'}</button>
      ${lesson.done.word
        ? '<button type="button" class="secondary-btn guided-secondary" data-guided-action="next-sentence">Continue to sentence</button>'
        : '<p class="guided-help">Listen once, then say the word aloud.</p>'}
    </article>`;
  }

  function sentenceCard() {
    const sentence = practiceSentence(currentWord());
    return `<article class="guided-card">
      <span class="guided-kicker">SENTENCE PRACTICE</span>
      <div class="guided-sentence" lang="fa" dir="rtl">${esc(sentence.fa)}</div>
      <div class="guided-latin">${esc(sentence.latin)}</div>
      <p>${esc(sentence.en)}</p>
      <button type="button" class="primary-btn guided-primary" data-guided-action="play-sentence">🔊 ${lesson.sentencePlayed ? 'Play sentence again' : 'Play sentence'}</button>
      ${lesson.sentencePlayed
        ? '<p class="guided-say">Say it aloud once.</p><button type="button" class="secondary-btn guided-secondary" data-guided-action="continue-recall">Continue to quick check</button>'
        : '<p>Listen to the complete phrase before moving on.</p>'}
      <div class="guided-inline">
        <button type="button" data-guided-action="slow-sentence">Slow</button>
        ${lesson.sentencePlayed ? '<button type="button" data-guided-action="play-sentence">Play again</button>' : '<span aria-hidden="true"></span>'}
      </div>
      <details class="guided-more"><summary>More pronunciation practice</summary><div>
        <button type="button" data-guided-action="repeat-sentence">Repeat sentence ×3</button>
        <button type="button" data-guided-action="word-sentence">Word → sentence</button>
        <button type="button" data-guided-action="hear-word-only">Hear word separately</button>
      </div></details>
    </article>`;
  }

  function recallCard() {
    const word = currentWord();
    return `<article class="guided-card">
      <span class="guided-kicker">QUICK MEANING CHECK</span>
      <h3>What does <span lang="fa" dir="rtl">${esc(word.fa)}</span> mean?</h3>
      <div class="guided-latin">${esc(word.latin)}</div>
      <div class="guided-choices">${recallChoices().map(index => `
        <button type="button" class="guided-choice${lesson.recall.answered ? (index === todaysWordIndex() ? ' correct' : lesson.recall.selected === index ? ' wrong' : '') : ''}" data-guided-recall="${index}" ${lesson.recall.answered ? 'disabled' : ''}>${esc(getWord(index).en)}</button>`).join('')}</div>
      ${lesson.recall.answered
        ? `<p class="guided-feedback ${lesson.recall.correct ? 'good' : 'bad'}">${lesson.recall.correct ? 'Correct.' : `Not quite. ${esc(word.fa)} means “${esc(word.en)}.”`}</p><button type="button" class="primary-btn guided-primary" data-guided-action="continue-script">Continue to letter practice</button>`
        : '<p>Choose the meaning before moving on.</p>'}
    </article>`;
  }

  function letterStudyCard() {
    const lessonData = SCRIPT_LESSONS[todayLetterIndex()];
    return `<article class="guided-card">
      <span class="guided-kicker">LEARN TODAY’S LETTER</span>
      <div class="guided-letter" lang="fa" dir="rtl">${esc(lessonData.letter)}</div>
      <h3>${esc(lessonData.name)} · Sound “${esc(lessonData.sound)}”</h3>
      <div class="guided-study-forms" aria-label="Letter forms">${['Alone', 'Start', 'Middle', 'End'].map((label, index) => `<div><small>${label}</small><strong lang="fa" dir="rtl">${esc(lessonData.forms?.[index] || lessonData.letter)}</strong></div>`).join('')}</div>
      <div class="guided-study-example"><small>Example word</small><strong lang="fa" dir="rtl">${esc(lessonData.exampleFa)}</strong><span>${esc(lessonData.exampleLatin)} · ${esc(lessonData.exampleEn)}</span></div>
      <button type="button" class="sentence-speak-btn guided-secondary" data-guided-action="hear-letter" data-letter-index="${todayLetterIndex()}">🔊 Hear ${esc(lessonData.exampleLatin)}</button>
      <button type="button" class="primary-btn guided-primary" data-guided-action="start-letter-quiz">Test me on this letter</button>
    </article>`;
  }

  function letterQuestion(index, past) {
    const lessonData = SCRIPT_LESSONS[index];
    const answered = past ? lesson.script.pastAnswered : lesson.script.todayAnswered;
    const selected = past ? lesson.script.pastSelected : lesson.script.todaySelected;
    const correct = past ? lesson.script.pastCorrect : lesson.script.todayCorrect;
    const type = letterQuestionType(index);
    const prompt = type === 'sound'
      ? `Which letter makes the “${lessonData.sound}” sound?`
      : `Which letter is called “${lessonData.name}”?`;
    const context = past
      ? lesson.script.pastDaysAgo === 1 ? 'YESTERDAY’S LETTER' : `${lesson.script.pastDaysAgo} DAYS AGO`
      : 'TODAY’S LETTER';
    const nextAction = past || lesson.script.pastIndex === null ? 'continue-reviews' : 'past-letter';
    const nextLabel = past || lesson.script.pastIndex === null ? 'Continue to vocabulary review' : 'Review an older letter';

    return `<article class="guided-card">
      <span class="guided-kicker">${context}</span>
      ${answered ? `<div class="guided-letter" lang="fa" dir="rtl">${esc(lessonData.letter)}</div><h3>${esc(lessonData.name)} · Sound “${esc(lessonData.sound)}”</h3>` : ''}
      <p>${esc(prompt)}</p>
      <div class="guided-letter-choices">${letterChoices(index, type).map(choiceIndex => `
        <button type="button" class="guided-letter-choice${answered ? (choiceIndex === index ? ' correct' : selected === choiceIndex ? ' wrong' : '') : ''}" data-guided-letter="${choiceIndex}" data-guided-letter-kind="${past ? 'past' : 'today'}" lang="fa" dir="rtl" ${answered ? 'disabled' : ''}>${esc(SCRIPT_LESSONS[choiceIndex].letter)}</button>`).join('')}</div>
      ${answered ? `<p class="guided-feedback ${correct ? 'good' : 'bad'}">${correct ? 'Correct.' : `Not quite. The answer is ${esc(lessonData.letter)} (${esc(lessonData.name)}).`}</p><button type="button" class="sentence-speak-btn guided-secondary" data-guided-action="hear-letter" data-letter-index="${index}">🔊 Hear ${esc(lessonData.exampleLatin)}</button><button type="button" class="primary-btn guided-primary" data-guided-action="${nextAction}">${nextLabel}</button>` : ''}
    </article>`;
  }

  function scriptCard() {
    if (!lesson.script.studyComplete && !lesson.script.todayAnswered) return letterStudyCard();
    if (lesson.script.phase === 'past' && lesson.script.pastIndex !== null) return letterQuestion(lesson.script.pastIndex, true);
    return letterQuestion(todayLetterIndex(), false);
  }

  function reviewCard() {
    const queue = lesson.reviews.queue;
    const position = lesson.reviews.position;
    if (!queue.length || position >= queue.length) {
      lesson.done.reviews = true;
      const next = nextIncomplete();
      lesson.step = next;
      if (next === 5) lesson.completedAt ||= Date.now();
      save();
      return next === 5
        ? doneCard()
        : `<article class="guided-card"><span class="guided-kicker">REVIEWS COMPLETE</span><h3>Your due reviews are finished.</h3><button type="button" class="primary-btn guided-primary" data-guided-action="next-required">Continue to ${esc(stepLabel(next))}</button></article>`;
    }

    const word = getWord(queue[position]);
    return `<article class="guided-card">
      <span class="guided-kicker">VOCABULARY REVIEW · ${position + 1} OF ${queue.length}</span>
      <h3>Say the Persian word for:</h3>
      <div class="guided-review-prompt">${esc(word.en)}</div>
      ${lesson.reviews.revealed
        ? `<div class="guided-answer"><strong lang="fa" dir="rtl">${esc(word.fa)}</strong><span>${esc(word.latin)}</span></div><div class="guided-ratings"><button type="button" class="rating-btn again" data-guided-rate="bad"><strong>Missed</strong><span>Review again soon</span></button><button type="button" class="rating-btn good" data-guided-rate="good"><strong>Got it</strong><span>Increase the gap</span></button></div>`
        : '<button type="button" class="primary-btn guided-primary" data-guided-action="reveal-review">Show Persian</button>'}
    </article>`;
  }

  function doneCard() {
    const word = currentWord();
    const letterCount = lesson.script.pastIndex === null ? 1 : 2;
    return `<article class="guided-card">
      <div class="guided-done">✓</div>
      <span class="guided-kicker">DONE FOR TODAY</span>
      <h3>You completed your daily Farsi lesson.</h3>
      <p>1 word · 1 sentence · ${letterCount} letter${letterCount === 1 ? '' : 's'} · ${lesson.reviews.queue.length} vocabulary review${lesson.reviews.queue.length === 1 ? '' : 's'}</p>
      <div class="guided-done-word"><strong lang="fa" dir="rtl">${esc(word.fa)}</strong><span>${esc(word.latin)} · ${esc(word.en)}</span></div>
      <button type="button" class="secondary-btn guided-secondary" data-guided-action="play-done-word">🔊 Hear today’s word again</button>
      <button type="button" class="primary-btn guided-primary" data-guided-action="extra">Extra practice</button>
    </article>`;
  }

  function activityHtml() {
    if (lesson.step === 0) return wordCard();
    if (lesson.step === 1) return sentenceCard();
    if (lesson.step === 2) return recallCard();
    if (lesson.step === 3) return scriptCard();
    if (lesson.step === 4) return reviewCard();
    return doneCard();
  }

  function render() {
    if (completedCount() === 5) lesson.step = 5;
    else if (lesson.step === 5) lesson.step = nextIncomplete();
    shell().innerHTML = `${headerHtml()}${activityHtml()}${overallProgressHtml()}<p id="guidedStatusV3" class="guided-status" role="status" aria-live="polite"></p>`;
  }

  function announce(message) {
    const status = document.getElementById('guidedStatusV3');
    if (status) status.textContent = message;
  }

  function move(step) {
    lesson.step = Math.max(0, Math.min(5, Number(step)));
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function play(item, button, options = {}) {
    const ok = await window.speakPractice([item], button, options);
    announce(ok ? 'Audio played successfully.' : 'Audio could not play.');
    return ok;
  }

  function recordTodayLetter(correct) {
    const script = read(SCRIPT_KEY, { attempts: 0, correct: 0, completed: {} });
    script.attempts = Number(script.attempts || 0) + 1;
    if (correct) {
      script.correct = Number(script.correct || 0) + 1;
      script.completed = script.completed || {};
      script.completed[todayKey()] = true;
    }
    write(SCRIPT_KEY, script);
  }

  function recordPastLetter(index, correct) {
    const review = letterReviewState();
    review.letters = review.letters || {};
    review.daily = review.daily || {};
    const stats = { attempts: 0, correct: 0, lastReviewed: 0, ...(review.letters[index] || {}) };
    stats.attempts += 1;
    if (correct) stats.correct += 1;
    stats.lastReviewed = Date.now();
    review.letters[index] = stats;
    const daily = { attempts: 0, correct: 0, ...(review.daily[todayKey()] || {}) };
    daily.attempts += 1;
    if (correct) daily.correct += 1;
    review.daily[todayKey()] = daily;
    write(LETTER_REVIEW_KEY, review);
  }

  function rateCard(index, result) {
    const card = state.cards[index];
    if (!card) return;
    card.lastReviewedAt = now();
    card.lastResult = result;
    if (result === 'bad') {
      card.bad += 1;
      card.streak = 0;
      card.intervalDays = 0;
      card.dueAt = now() + 600000;
      state.totalBad += 1;
    } else {
      card.good += 1;
      card.streak += 1;
      const intervals = [1, 3, 7, 14, 30, 60, 120];
      card.intervalDays = intervals[Math.min(card.streak - 1, intervals.length - 1)];
      card.dueAt = now() + card.intervalDays * DAY_MS;
      state.totalGood += 1;
    }
    const key = todayKey();
    state.history[key] = state.history[key] || { opened: true, reviewed: 0 };
    state.history[key].reviewed += 1;
    saveState();
    renderStats();
    renderDeck();
  }

  async function handleAction(button) {
    const action = button.dataset.guidedAction;
    const word = currentWord();
    const sentence = practiceSentence(word);

    if (action === 'play-word') {
      const ok = await play({ text: word.fa, phoneticHint: word.latin }, button);
      if (ok && lesson.step === 0) {
        lesson.done.word = true;
        save();
        render();
      }
      return;
    }
    if (action === 'hear-word-only' || action === 'play-done-word') {
      await play({ text: word.fa, phoneticHint: word.latin }, button);
      return;
    }
    if (action === 'next-sentence') return move(1);

    if (['play-sentence', 'slow-sentence', 'repeat-sentence', 'word-sentence'].includes(action)) {
      let ok = false;
      if (action === 'word-sentence') {
        ok = await window.speakPractice([
          { text: word.fa, phoneticHint: word.latin },
          { text: sentence.fa, phoneticHint: sentence.latin }
        ], button, { pauseMs: 700 });
      } else {
        ok = await window.speakPractice(
          [{ text: sentence.fa, phoneticHint: sentence.latin }],
          button,
          action === 'slow-sentence'
            ? { speed: 'slow' }
            : action === 'repeat-sentence'
              ? { repeat: 3, pauseMs: 500 }
              : {}
        );
      }
      announce(ok ? 'Sentence audio played successfully.' : 'Sentence audio could not play.');
      if (ok) {
        lesson.sentencePlayed = true;
        save();
        render();
      }
      return;
    }

    if (action === 'continue-recall') {
      lesson.done.sentence = true;
      return move(2);
    }
    if (action === 'continue-script') return move(3);
    if (action === 'start-letter-quiz') {
      lesson.script.studyComplete = true;
      localStorage.setItem(`${STUDIED_PREFIX}${todayKey()}`, '1');
      save();
      render();
      return;
    }
    if (action === 'past-letter') {
      lesson.script.phase = 'past';
      save();
      render();
      return;
    }
    if (action === 'continue-reviews') {
      lesson.done.script = true;
      return move(4);
    }
    if (action === 'hear-letter') {
      const letter = SCRIPT_LESSONS[Number(button.dataset.letterIndex)];
      if (letter) await play({ text: letter.exampleFa, phoneticHint: letter.exampleLatin }, button);
      return;
    }
    if (action === 'reveal-review') {
      lesson.reviews.revealed = true;
      save();
      render();
      return;
    }
    if (action === 'next-required') return move(nextIncomplete());
    if (action === 'extra') {
      showView('review');
      buildReviewQueue(true);
    }
  }

  document.addEventListener('click', event => {
    const root = event.target.closest('#guidedTodayV3');
    if (!root) return;

    const jump = event.target.closest('[data-guided-jump]');
    if (jump) {
      move(jump.dataset.guidedJump);
      return;
    }

    const action = event.target.closest('[data-guided-action]');
    if (action) {
      handleAction(action);
      return;
    }

    const recall = event.target.closest('[data-guided-recall]');
    if (recall && !lesson.recall.answered) {
      const selected = Number(recall.dataset.guidedRecall);
      lesson.recall = { answered: true, selected, correct: selected === todaysWordIndex() };
      lesson.done.recall = true;
      save();
      render();
      return;
    }

    const letterChoice = event.target.closest('[data-guided-letter]');
    if (letterChoice) {
      const selected = Number(letterChoice.dataset.guidedLetter);
      const kind = letterChoice.dataset.guidedLetterKind;
      if (kind === 'today' && !lesson.script.todayAnswered) {
        const correct = selected === todayLetterIndex();
        Object.assign(lesson.script, { todayAnswered: true, todaySelected: selected, todayCorrect: correct });
        recordTodayLetter(correct);
      } else if (kind === 'past' && !lesson.script.pastAnswered && lesson.script.pastIndex !== null) {
        const correct = selected === lesson.script.pastIndex;
        Object.assign(lesson.script, { pastAnswered: true, pastSelected: selected, pastCorrect: correct });
        recordPastLetter(lesson.script.pastIndex, correct);
      }
      save();
      render();
      return;
    }

    const rating = event.target.closest('[data-guided-rate]');
    if (rating && lesson.reviews.revealed) {
      const index = lesson.reviews.queue[lesson.reviews.position];
      rateCard(index, rating.dataset.guidedRate);
      lesson.reviews.position += 1;
      lesson.reviews.revealed = false;
      if (lesson.reviews.position >= lesson.reviews.queue.length) {
        lesson.done.reviews = true;
        lesson.step = nextIncomplete();
        if (lesson.step === 5) lesson.completedAt = Date.now();
      }
      save();
      render();
    }
  });

  const previousShowView = showView;
  showView = function showViewWithGuidedToday(name) {
    previousShowView(name);
    if (name === 'today') render();
  };

  save();
  render();
})();
