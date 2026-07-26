// Four-step guided daily lesson. Vocabulary and older-letter reviews stay optional.
(() => {
  const KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const STEP_KEYS = ['word', 'sentence', 'recall', 'script'];
  const ROOT_ID = 'guidedTodayV3';

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
  const esc = value => escapeHTML(value);
  const currentWord = () => getWord(todaysWordIndex());
  const todayLetterIndex = () => dayNumber() % SCRIPT_LESSONS.length;

  function practiceSentence(word) {
    if (word?.exFa) return { fa: word.exFa, latin: word.exLatin || '', en: word.exEn || '' };
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

  function hasOlderLetters() {
    return typeof window.getStudiedScriptCandidates === 'function'
      && window.getStudiedScriptCandidates(SCRIPT_LESSONS.length).length > 0;
  }

  function freshDayState() {
    const legacy = read('farsi-daily-guided-v1', {})[todayKey()] || {};
    const script = read(SCRIPT_KEY, { completed: {} });
    const todayCorrect = Boolean(script.completed?.[todayKey()]);
    const done = {
      word: Boolean(legacy.wordHeard),
      sentence: Boolean(legacy.sentenceHeard),
      recall: false,
      script: todayCorrect
    };
    const step = STEP_KEYS.findIndex(key => !done[key]);
    return {
      step: step < 0 ? STEP_KEYS.length : step,
      done,
      sentencePlayed: done.sentence,
      recall: { answered: false, selected: null, correct: false },
      script: {
        studyComplete: localStorage.getItem(`${STUDIED_PREFIX}${todayKey()}`) === '1',
        phase: 'today',
        todayAnswered: todayCorrect,
        todaySelected: todayCorrect ? todayLetterIndex() : null,
        todayCorrect,
        pastIndex: null,
        pastDaysAgo: null,
        pastAnswered: false,
        pastSelected: null,
        pastCorrect: false
      },
      completedAt: null
    };
  }

  let store;
  let lesson;

  function nextIncomplete(day = lesson) {
    const index = STEP_KEYS.findIndex(key => !day.done?.[key]);
    return index < 0 ? STEP_KEYS.length : index;
  }

  function normalizeLesson(saved = {}) {
    const defaults = freshDayState();
    const day = {
      ...defaults,
      ...saved,
      done: { ...defaults.done, ...(saved.done || {}) },
      recall: { ...defaults.recall, ...(saved.recall || {}) },
      script: { ...defaults.script, ...(saved.script || {}) }
    };

    day.script.studyComplete = Boolean(
      day.script.studyComplete
      || day.script.todayAnswered
      || localStorage.getItem(`${STUDIED_PREFIX}${todayKey()}`) === '1'
    );

    if (day.recall.answered && day.recall.correct !== true) day.done.recall = false;
    const script = read(SCRIPT_KEY, { completed: {} });
    const todayCorrect = Boolean(day.script.todayCorrect || script.completed?.[todayKey()]);
    day.script.todayCorrect = todayCorrect;
    day.done.script = todayCorrect;
    day.script.phase = 'today';

    const step = Number(day.step);
    const invalidStep = !Number.isInteger(step) || step < 0 || step > STEP_KEYS.length;
    const allDone = STEP_KEYS.every(key => Boolean(day.done[key]));
    if (allDone) {
      day.step = STEP_KEYS.length;
      day.completedAt ||= Date.now();
    } else {
      day.completedAt = null;
      if (invalidStep || step === STEP_KEYS.length || day.done[STEP_KEYS[step]]) day.step = nextIncomplete(day);
    }
    return day;
  }

  function loadLesson() {
    window.FarsiGuidedIntegrity?.sanitizeCardsBeforeGuidedRender?.();
    store = read(KEY, { days: {} });
    store.days = store.days && typeof store.days === 'object' && !Array.isArray(store.days) ? store.days : {};
    lesson = normalizeLesson(store.days[todayKey()] || {});
    save();
  }

  function save() {
    store.days[todayKey()] = lesson;
    write(KEY, store);
  }

  function completedCount() {
    return STEP_KEYS.filter(key => lesson.done[key]).length;
  }

  function stepLabel(index) {
    return [
      'Hear today’s word',
      'Use it in a sentence',
      'Check your memory',
      'Learn today’s letter'
    ][index];
  }

  function shell() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.className = 'guided-today';
      document.getElementById('todayView')?.prepend(root);
    }
    return root;
  }

  function headerHtml() {
    const complete = completedCount();
    const finished = lesson.step === STEP_KEYS.length;
    return `<header class="guided-head">
      <div><p class="eyebrow">TODAY’S LESSON</p><h2>${finished ? 'Daily lesson complete' : `Step ${lesson.step + 1} of ${STEP_KEYS.length}`}</h2><p>${finished ? 'Everything required for today is saved.' : esc(stepLabel(lesson.step))}</p></div>
    </header>
    <div class="guided-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${STEP_KEYS.length}" aria-valuenow="${complete}" aria-label="${complete} of ${STEP_KEYS.length} lesson steps complete"><span style="width:${complete * 25}%"></span></div>`;
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
      if (!values.includes(index) && getWord(index)?.en !== currentWord().en) values.push(index);
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
      return type !== 'sound' || primarySound(SCRIPT_LESSONS[index].sound) !== primarySound(target.sound);
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
        ? '<p class="guided-say">Say it aloud once.</p><button type="button" class="secondary-btn guided-secondary" data-guided-action="continue-recall">Continue to memory check</button>'
        : '<p>Listen to the complete phrase before moving on.</p>'}
      <div class="guided-inline single"><button type="button" data-guided-action="slow-sentence">Play slowly</button></div>
      <details class="guided-more"><summary>More pronunciation practice</summary><div>
        <button type="button" data-guided-action="repeat-sentence">Repeat sentence ×3</button>
        <button type="button" data-guided-action="word-sentence">Word → sentence</button>
        <button type="button" data-guided-action="hear-word-only">Hear word separately</button>
      </div></details>
    </article>`;
  }

  function recallCard() {
    const word = currentWord();
    const answered = lesson.recall.answered;
    const correct = lesson.recall.correct;
    return `<article class="guided-card">
      <span class="guided-kicker">MEMORY CHECK</span>
      <h3>What does the word you just heard mean?</h3>
      <button type="button" class="secondary-btn guided-audio-cue" data-guided-action="play-recall-word">🔊 Play word</button>
      <div class="guided-choices">${recallChoices().map(index => `
        <button type="button" class="guided-choice${answered ? (index === todaysWordIndex() ? ' correct' : lesson.recall.selected === index ? ' wrong' : '') : ''}" data-guided-recall="${index}" ${answered ? 'disabled' : ''}>${esc(getWord(index).en)}</button>`).join('')}</div>
      ${answered ? `<div class="guided-recall-reveal"><strong lang="fa" dir="rtl">${esc(word.fa)}</strong><span>${esc(word.latin)}</span></div>
        <p class="guided-feedback ${correct ? 'good' : 'bad'}">${correct ? 'Correct.' : `Not quite. It means “${esc(word.en)}.”`}</p>
        <button type="button" class="primary-btn guided-primary" data-guided-action="${correct ? 'continue-script' : 'retry-recall'}">${correct ? 'Continue to today’s letter' : 'Hear it and try again'}</button>`
        : '<p>Listen, then choose the meaning.</p>'}
    </article>`;
  }

  function letterStudyCard() {
    const data = SCRIPT_LESSONS[todayLetterIndex()];
    return `<article class="guided-card">
      <span class="guided-kicker">LEARN TODAY’S LETTER</span>
      <div class="guided-letter" lang="fa" dir="rtl">${esc(data.letter)}</div>
      <h3>${esc(data.name)} · Sound “${esc(data.sound)}”</h3>
      <div class="guided-study-forms" aria-label="Letter forms">${['Alone', 'Start', 'Middle', 'End'].map((label, index) => `<div><small>${label}</small><strong lang="fa" dir="rtl">${esc(data.forms?.[index] || data.letter)}</strong></div>`).join('')}</div>
      <div class="guided-study-example"><small>Example word</small><strong lang="fa" dir="rtl">${esc(data.exampleFa)}</strong><span>${esc(data.exampleLatin)} · ${esc(data.exampleEn)}</span></div>
      <button type="button" class="sentence-speak-btn guided-secondary" data-guided-action="hear-letter" data-letter-index="${todayLetterIndex()}">🔊 Hear the example word</button>
      <button type="button" class="primary-btn guided-primary" data-guided-action="start-letter-quiz">Start letter quiz</button>
    </article>`;
  }

  function letterQuestion() {
    const index = todayLetterIndex();
    const data = SCRIPT_LESSONS[index];
    const answered = lesson.script.todayAnswered;
    const selected = lesson.script.todaySelected;
    const correct = lesson.script.todayCorrect;
    const type = letterQuestionType(index);
    const prompt = type === 'sound'
      ? `Which letter makes the “${data.sound}” sound?`
      : `Which letter is called “${data.name}”?`;

    return `<article class="guided-card">
      <span class="guided-kicker">TODAY’S LETTER QUIZ</span>
      ${answered ? `<div class="guided-letter" lang="fa" dir="rtl">${esc(data.letter)}</div><h3>${esc(data.name)} · Sound “${esc(data.sound)}”</h3>` : ''}
      <p>${esc(prompt)}</p>
      <div class="guided-letter-choices">${letterChoices(index, type).map(choiceIndex => `
        <button type="button" class="guided-letter-choice${answered ? (choiceIndex === index ? ' correct' : selected === choiceIndex ? ' wrong' : '') : ''}" data-guided-letter="${choiceIndex}" lang="fa" dir="rtl" ${answered ? 'disabled' : ''}>${esc(SCRIPT_LESSONS[choiceIndex].letter)}</button>`).join('')}</div>
      ${answered ? `<p class="guided-feedback ${correct ? 'good' : 'bad'}">${correct ? 'Correct.' : `Not quite. The answer is ${esc(data.letter)} (${esc(data.name)}).`}</p>
        <button type="button" class="sentence-speak-btn guided-secondary" data-guided-action="hear-letter" data-letter-index="${index}">🔊 Hear the example word</button>
        <button type="button" class="primary-btn guided-primary" data-guided-action="${correct ? 'finish-lesson' : 'retry-today-letter'}">${correct ? 'Complete today’s lesson' : 'Try this letter again'}</button>` : ''}
    </article>`;
  }

  function scriptCard() {
    if (!lesson.script.studyComplete && !lesson.script.todayAnswered) return letterStudyCard();
    return letterQuestion();
  }

  function doneCard() {
    const word = currentWord();
    const due = dueCardIndexes().length;
    const reviewLabel = due > 0
      ? `Review ${due} due word${due === 1 ? '' : 's'}`
      : 'Practice more words';
    const reviewMessage = due > 0
      ? `${due} additional word${due === 1 ? ' is' : 's are'} ready for review.`
      : 'No vocabulary reviews are due right now.';
    return `<article class="guided-card">
      <div class="guided-done">✓</div>
      <span class="guided-kicker">DONE FOR TODAY</span>
      <h3>You completed your daily Farsi lesson.</h3>
      <p>1 word · 1 sentence · 1 memory check · 1 letter</p>
      <div class="guided-done-word"><strong lang="fa" dir="rtl">${esc(word.fa)}</strong><span>${esc(word.latin)} · ${esc(word.en)}</span></div>
      <p class="guided-optional-note">${reviewMessage}</p>
      <button type="button" class="primary-btn guided-primary" data-guided-action="extra-reviews">${reviewLabel}</button>
      ${hasOlderLetters() ? '<button type="button" class="secondary-btn guided-secondary" data-guided-action="extra-letters">Practice older letters</button>' : ''}
      <button type="button" class="secondary-btn guided-secondary" data-guided-action="play-done-word">🔊 Hear today’s word again</button>
    </article>`;
  }

  function activityHtml() {
    return [wordCard, sentenceCard, recallCard, scriptCard, doneCard][lesson.step]?.() || doneCard();
  }

  function render() {
    lesson = normalizeLesson(lesson);
    shell().innerHTML = `${headerHtml()}${activityHtml()}<p id="guidedStatusV3" class="guided-status" role="status" aria-live="polite"></p>`;
    save();
  }

  function announce(message) {
    const status = document.getElementById('guidedStatusV3');
    if (status) status.textContent = message;
  }

  function move(step) {
    lesson.step = Math.max(0, Math.min(STEP_KEYS.length, Number(step)));
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function play(items, button, options = {}) {
    const list = Array.isArray(items) ? items : [items];
    const ok = await window.speakPractice(list, button, options);
    announce(ok ? 'Audio played successfully.' : 'Audio could not play.');
    return ok;
  }

  function recordTodayLetter(correct) {
    const script = read(SCRIPT_KEY, { attempts: 0, correct: 0, completed: {} });
    script.attempts = Number(script.attempts || 0) + 1;
    if (correct) {
      script.correct = Number(script.correct || 0) + 1;
      script.completed ||= {};
      script.completed[todayKey()] = true;
    }
    write(SCRIPT_KEY, script);
  }

  function resetRecall() {
    lesson.recall = { answered: false, selected: null, correct: false };
    lesson.done.recall = false;
    lesson.step = 2;
  }

  function resetTodayLetter() {
    lesson.done.script = false;
    lesson.completedAt = null;
    lesson.step = 3;
    Object.assign(lesson.script, {
      studyComplete: true,
      phase: 'today',
      todayAnswered: false,
      todaySelected: null,
      todayCorrect: false
    });
  }

  async function handleAction(button) {
    const action = button.dataset.guidedAction;
    const word = currentWord();
    const sentence = practiceSentence(word);

    if (action === 'play-word') {
      if (await play({ text: word.fa, phoneticHint: word.latin }, button)) lesson.done.word = true;
      render();
      return;
    }
    if (['hear-word-only', 'play-done-word', 'play-recall-word'].includes(action)) {
      await play({ text: word.fa, phoneticHint: word.latin }, button);
      return;
    }
    if (action === 'next-sentence') return move(1);

    if (['play-sentence', 'slow-sentence', 'repeat-sentence', 'word-sentence'].includes(action)) {
      const items = action === 'word-sentence'
        ? [{ text: word.fa, phoneticHint: word.latin }, { text: sentence.fa, phoneticHint: sentence.latin }]
        : [{ text: sentence.fa, phoneticHint: sentence.latin }];
      const options = action === 'slow-sentence'
        ? { speed: 'slow' }
        : action === 'repeat-sentence'
          ? { repeat: 3, pauseMs: 500 }
          : action === 'word-sentence'
            ? { pauseMs: 700 }
            : {};
      if (await play(items, button, options)) lesson.sentencePlayed = true;
      render();
      return;
    }

    if (action === 'continue-recall') {
      lesson.done.sentence = true;
      return move(2);
    }
    if (action === 'retry-recall') {
      resetRecall();
      save();
      render();
      const replay = document.querySelector(`#${ROOT_ID} [data-guided-action="play-recall-word"]`);
      if (replay) await play({ text: word.fa, phoneticHint: word.latin }, replay);
      return;
    }
    if (action === 'continue-script') return move(3);
    if (action === 'start-letter-quiz') {
      lesson.script.studyComplete = true;
      localStorage.setItem(`${STUDIED_PREFIX}${todayKey()}`, '1');
      return render();
    }
    if (action === 'retry-today-letter') {
      resetTodayLetter();
      return render();
    }
    if (action === 'finish-lesson') {
      if (!lesson.script.todayCorrect) return;
      lesson.done.script = true;
      lesson.step = STEP_KEYS.length;
      lesson.completedAt = Date.now();
      save();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (action === 'hear-letter') {
      const letter = SCRIPT_LESSONS[Number(button.dataset.letterIndex)];
      if (letter) await play({ text: letter.exampleFa, phoneticHint: letter.exampleLatin }, button);
      return;
    }
    if (action === 'extra-reviews') {
      const hasDue = dueCardIndexes().length > 0;
      showView('review');
      buildReviewQueue(!hasDue);
      return;
    }
    if (action === 'extra-letters') {
      showView('script');
      const review = document.getElementById('pastScriptReviewCard');
      if (review) {
        review.open = true;
        review.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  document.addEventListener('click', event => {
    if (!event.target.closest(`#${ROOT_ID}`)) return;

    const action = event.target.closest('[data-guided-action]');
    if (action) {
      handleAction(action);
      return;
    }

    const recall = event.target.closest('[data-guided-recall]');
    if (recall && !lesson.recall.answered) {
      const selected = Number(recall.dataset.guidedRecall);
      const correct = selected === todaysWordIndex();
      lesson.recall = { answered: true, selected, correct };
      lesson.done.recall = correct;
      render();
      return;
    }

    const choice = event.target.closest('[data-guided-letter]');
    if (choice && !lesson.script.todayAnswered) {
      const selected = Number(choice.dataset.guidedLetter);
      const correct = selected === todayLetterIndex();
      Object.assign(lesson.script, { todayAnswered: true, todaySelected: selected, todayCorrect: correct });
      recordTodayLetter(correct);
      render();
    }
  });

  const previousShowView = showView;
  showView = function showViewWithGuidedToday(name) {
    previousShowView(name);
    if (name === 'today') {
      loadLesson();
      render();
    }
  };

  window.FarsiGuidedToday = {
    render,
    reloadFromStorage() {
      loadLesson();
      render();
    }
  };

  loadLesson();
  render();
})();
