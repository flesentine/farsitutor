// Farsi Daily design-spec renderer: four required steps and one clear win.
(() => {
  const KEY = 'farsi-guided-today-v2';
  const ROOT_ID = 'guidedTodayV3';
  const CORE_STEPS = ['word', 'sentence', 'recall', 'script'];
  const sessionEvents = new Set();

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

  function practiceSentence(word) {
    if (word?.exFa) return { fa: word.exFa, latin: word.exLatin || '', en: word.exEn || '' };
    return {
      fa: `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`,
      latin: `Man kalame-ye “${word.latin}” râ yâd migiram.`,
      en: `I am learning the Persian word for “${word.en}.”`
    };
  }

  function track(name, detail = {}) {
    const payload = { event: name, date: todayKey(), wordIndex: todaysWordIndex(), ...detail };
    document.dispatchEvent(new CustomEvent('farsi:analytics', { detail: payload }));
    if (typeof window.gtag === 'function') window.gtag('event', name, payload);
  }

  function trackOnce(name, detail = {}) {
    const key = `${todayKey()}:${name}:${detail.step || ''}`;
    if (sessionEvents.has(key)) return;
    sessionEvents.add(key);
    track(name, detail);
  }

  function freshLesson() {
    return {
      version: 'visual-spec-v1',
      started: false,
      step: 0,
      done: { word: false, sentence: false, recall: false, script: false },
      recall: { selected: null, submitted: false, correct: false },
      audio: { wordAttempted: false, sentenceAttempted: false },
      completedAt: null
    };
  }

  let store;
  let lesson;

  function normalizeLesson(saved = {}) {
    const base = freshLesson();
    const legacyDone = saved.done && typeof saved.done === 'object' ? saved.done : {};
    const day = {
      ...base,
      ...saved,
      done: {
        word: Boolean(legacyDone.word),
        sentence: Boolean(legacyDone.sentence),
        recall: Boolean(legacyDone.recall),
        script: Boolean(legacyDone.script)
      },
      recall: { ...base.recall, ...(saved.recall || {}) },
      audio: { ...base.audio, ...(saved.audio || {}) }
    };

    day.started = Boolean(day.started || CORE_STEPS.some(key => day.done[key]) || saved.completedAt);
    day.recall.selected = Number.isInteger(Number(day.recall.selected)) ? Number(day.recall.selected) : null;
    day.recall.submitted = Boolean(day.recall.submitted || saved.recall?.answered);
    day.recall.correct = Boolean(day.recall.correct);
    if (day.recall.submitted && !day.recall.correct) day.done.recall = false;

    if (CORE_STEPS.every(key => day.done[key])) {
      day.step = 4;
      day.completedAt ||= Date.now();
    } else {
      day.completedAt = null;
      const requested = Number(day.step);
      const firstIncomplete = CORE_STEPS.findIndex(key => !day.done[key]);
      day.step = Number.isInteger(requested) && requested >= 0 && requested <= 3
        ? requested
        : Math.max(0, firstIncomplete);
    }
    day.version = 'visual-spec-v1';
    return day;
  }

  function loadLesson() {
    store = read(KEY, { days: {} });
    store.days = store.days && typeof store.days === 'object' && !Array.isArray(store.days) ? store.days : {};
    lesson = normalizeLesson(store.days[todayKey()] || {});
    save();
  }

  function save() {
    store.days[todayKey()] = lesson;
    write(KEY, store);
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

  function audioIcon() {
    return '<svg class="audio-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15 9.5a4 4 0 0 1 0 5M17.7 7a7.5 7.5 0 0 1 0 10"/></svg>';
  }

  function entryCard() {
    const word = currentWord();
    const due = dueCardIndexes().length;
    return `<section class="today-entry" aria-labelledby="todayEntryTitle">
      <header class="today-entry-head">
        <div><p class="eyebrow">TODAY</p><h2 id="todayEntryTitle">One useful word and letter. About 4 minutes.</h2></div>
        <span class="streak-pill"><strong>${streakDays()}</strong> day streak</span>
      </header>
      <article class="today-preview">
        <span class="guided-kicker">TODAY’S WORD</span>
        <button type="button" class="preview-word" data-guided-action="start" aria-label="Start today’s lesson with ${esc(word.fa)}">
          <span lang="fa" dir="rtl">${esc(word.fa)}</span>
          <small>Ready when you are.</small>
        </button>
      </article>
      <button type="button" class="primary-btn guided-primary" data-guided-action="start">Start today’s lesson</button>
      <p class="entry-meta">${due ? `${due} review${due === 1 ? '' : 's'} due after your lesson` : 'No reviews due today'} · optional</p>
    </section>`;
  }

  function stepHeader() {
    const number = lesson.step + 1;
    return `<header class="guided-head">
      <button type="button" class="lesson-back" data-guided-action="back" aria-label="Go back">‹</button>
      <div class="guided-head-copy"><strong>Today · ${number} of 4</strong><span>${['Hear the word', 'Use it in context', 'Recall the word', 'Practice the script'][lesson.step]}</span></div>
      <span class="guided-count" aria-hidden="true">${number}/4</span>
    </header>
    <div class="guided-bar" role="progressbar" aria-label="Daily lesson progress" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${number}"><span style="width:${number / 4 * 100}%"></span></div>`;
  }

  function wordCard() {
    const word = currentWord();
    return `<article class="guided-card">
      <span class="guided-kicker">HEAR THE WORD</span>
      <button type="button" class="guided-word-listen" data-guided-action="play-word" aria-label="Hear ${esc(word.fa)}">
        <span class="guided-fa" lang="fa" dir="rtl">${esc(word.fa)}</span>
        <span class="guided-latin">${esc(word.latin)}</span>
        <span class="guided-meaning">${esc(word.en)}</span>
      </button>
      <button type="button" class="${lesson.done.word ? 'secondary-btn' : 'primary-btn'} guided-audio" data-guided-action="play-word">${audioIcon()}<span>${lesson.done.word ? 'Hear word again' : 'Hear word'}</span></button>
      <button type="button" class="primary-btn guided-primary" data-guided-action="continue-sentence" ${lesson.done.word ? '' : 'disabled'}>Continue</button>
      <p class="guided-help">Listen as many times as you like, then choose Continue.</p>
    </article>`;
  }

  function sentenceCard() {
    const sentence = practiceSentence(currentWord());
    return `<article class="guided-card">
      <span class="guided-kicker">USE IT IN CONTEXT</span>
      <button type="button" class="guided-word-listen sentence-listen" data-guided-action="play-sentence" aria-label="Hear the Persian sentence">
        <span class="guided-sentence" lang="fa" dir="rtl">${esc(sentence.fa)}</span>
        <span class="guided-latin">${esc(sentence.latin)}</span>
        <span class="guided-meaning sentence-meaning">${esc(sentence.en)}</span>
      </button>
      <button type="button" class="${lesson.done.sentence ? 'secondary-btn' : 'primary-btn'} guided-audio" data-guided-action="play-sentence">${audioIcon()}<span>${lesson.done.sentence ? 'Hear sentence again' : 'Hear sentence'}</span></button>
      <button type="button" class="text-action" data-guided-action="slow-sentence">Slow</button>
      <button type="button" class="primary-btn guided-primary" data-guided-action="continue-recall" ${lesson.done.sentence ? '' : 'disabled'}>Continue</button>
      <p class="guided-help">Listen as many times as you like. Next, you’ll recall the word—not the sentence.</p>
    </article>`;
  }

  function recallCard() {
    const word = currentWord();
    const submitted = lesson.recall.submitted;
    const correct = lesson.recall.correct;
    return `<article class="guided-card recall-card">
      <span class="guided-kicker">RECALL</span>
      <h3>What does today’s word mean?</h3>
      <p class="guided-help recall-help">Play the word again, then choose its English meaning.</p>
      <button type="button" class="secondary-btn guided-audio-cue" data-guided-action="play-recall-word">${audioIcon()}<span>Play today’s word</span></button>
      <div class="guided-choices" role="radiogroup" aria-label="Choose the English meaning">${recallChoices().map(index => {
        const selected = lesson.recall.selected === index;
        const stateClass = submitted ? (index === todaysWordIndex() ? ' correct' : selected ? ' wrong' : '') : selected ? ' selected' : '';
        return `<button type="button" role="radio" aria-checked="${selected}" class="guided-choice${stateClass}" data-guided-recall="${index}" ${submitted ? 'disabled' : ''}><span class="choice-dot" aria-hidden="true"></span>${esc(getWord(index).en)}</button>`;
      }).join('')}</div>
      ${submitted ? `<div class="guided-feedback ${correct ? 'good' : 'bad'}" role="status">
          <strong>${correct ? 'Correct' : 'Not quite'}</strong>
          <span><b lang="fa" dir="rtl">${esc(word.fa)}</b> · ${esc(word.latin)} means “${esc(word.en)}.”</span>
          ${correct ? '' : '<small>You’ll see it again soon.</small>'}
        </div>
        <button type="button" class="primary-btn guided-primary" data-guided-action="${correct ? 'continue-script' : 'retry-recall'}">${correct ? 'Continue to Script' : 'Try once more'}</button>`
        : `<button type="button" class="primary-btn guided-primary" data-guided-action="check-recall" ${lesson.recall.selected == null ? 'disabled' : ''}>Check</button>`}
    </article>`;
  }

  function scriptGateCard() {
    return `${stepHeader()}<article class="guided-card script-gate-card">
      <span class="guided-kicker">REQUIRED SCRIPT PRACTICE</span>
      <h2>Finish with today’s Persian letter.</h2>
      <p>Learn its forms and complete the one-question letter quiz.</p>
      <button type="button" class="primary-btn guided-primary" data-guided-action="open-script">Start Script Practice</button>
    </article>`;
  }

  function completeLesson() {
    lesson.done = { word: true, sentence: true, recall: true, script: true };
    lesson.step = 4;
    lesson.completedAt ||= Date.now();
    addWord(todaysWordIndex(), true);
    state.history[todayKey()] ||= { opened: true, reviewed: 0 };
    state.history[todayKey()].completed = true;
    saveState();
    save();
    track('lesson_completed');
  }

  function doneCard() {
    if (!lesson.completedAt) completeLesson();
    const word = currentWord();
    const due = dueCardIndexes().length;
    return `<article class="guided-card completion-card">
      <span class="complete-pill">Lesson complete</span>
      <div class="guided-done" aria-hidden="true">✓</div>
      <h2>Nice work!</h2>
      <p>Your daily word is saved.</p>
      <div class="streak-number"><strong>${streakDays()}</strong><span>day streak</span></div>
      <div class="guided-done-word"><strong lang="fa" dir="rtl">${esc(word.fa)}</strong><span>${esc(word.latin)} · ${esc(word.en)}</span></div>
      ${due ? `<button type="button" class="secondary-btn optional-action" data-guided-action="open-review"><span><small>OPTIONAL</small>Review ${due} due word${due === 1 ? '' : 's'}</span><b>›</b></button>` : '<p class="optional-empty">No reviews are due right now.</p>'}
      <button type="button" class="text-action done-action" data-guided-action="done">Done for today</button>
    </article>`;
  }

  function render() {
    lesson = normalizeLesson(lesson);
    const activity = !lesson.started
      ? entryCard()
      : lesson.step === 4
        ? doneCard()
        : lesson.step === 3
          ? scriptGateCard()
          : `${stepHeader()}${[wordCard, sentenceCard, recallCard][lesson.step]()}`;
    shell().innerHTML = `${activity}<p id="guidedStatusV3" class="guided-status" role="status" aria-live="polite"></p>`;
    save();
    trackOnce('today_viewed', { state: !lesson.started ? 'entry' : lesson.step === 4 ? 'complete' : `step_${lesson.step + 1}` });
  }

  function announce(message, error = false) {
    const status = document.getElementById('guidedStatusV3');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function move(step) {
    lesson.started = true;
    lesson.step = Math.max(0, Math.min(4, Number(step)));
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function play(items, button, options = {}) {
    const list = Array.isArray(items) ? items : [items];
    track('audio_played', { kind: options.kind || 'word', speed: options.speed || 'normal' });
    try {
      const ok = await window.speakPractice(list, button, options);
      announce(ok ? 'Audio played.' : 'Audio is unavailable. You can retry or continue.', !ok);
      return Boolean(ok);
    } catch {
      announce('Audio is unavailable. You can retry or continue.', true);
      return false;
    }
  }

  function unlockAudioStep(kind) {
    const root = shell();
    const continueAction = kind === 'word' ? 'continue-sentence' : 'continue-recall';
    const continueButton = root.querySelector(`[data-guided-action="${continueAction}"]`);
    if (continueButton) continueButton.disabled = false;
    const audioButton = root.querySelector(`.guided-audio[data-guided-action="play-${kind}"]`);
    if (audioButton) {
      audioButton.classList.remove('primary-btn');
      audioButton.classList.add('secondary-btn');
      const label = audioButton.querySelector(':scope > span:last-child');
      if (label) label.textContent = kind === 'word' ? 'Hear word again' : 'Hear sentence again';
    }
  }

  function goBack() {
    if (lesson.step <= 0) {
      lesson.started = false;
      save();
      render();
      return;
    }
    lesson.step -= 1;
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAction(button) {
    const action = button.dataset.guidedAction;
    const word = currentWord();
    const sentence = practiceSentence(word);

    if (action === 'start') {
      lesson.started = true;
      lesson.step = lesson.done.word ? (lesson.done.sentence ? (lesson.done.recall ? 3 : 2) : 1) : 0;
      track('lesson_started');
      return move(lesson.step);
    }
    if (action === 'back') {
      return goBack();
    }
    if (action === 'play-word') {
      lesson.audio.wordAttempted = true;
      save();
      const firstCompletion = !lesson.done.word;
      await play({ text: word.fa, phoneticHint: word.latin }, button, { kind: 'word' });
      lesson.done.word = true;
      save();
      if (firstCompletion) trackOnce('step_completed', { step: 'word' });
      unlockAudioStep('word');
      return;
    }
    if (action === 'continue-sentence') return move(1);
    if (action === 'play-sentence' || action === 'slow-sentence') {
      lesson.audio.sentenceAttempted = true;
      save();
      const firstCompletion = !lesson.done.sentence;
      await play({ text: sentence.fa, phoneticHint: sentence.latin }, button, {
        kind: 'sentence', speed: action === 'slow-sentence' ? 'slow' : 'normal'
      });
      lesson.done.sentence = true;
      save();
      if (firstCompletion) trackOnce('step_completed', { step: 'sentence' });
      unlockAudioStep('sentence');
      return;
    }
    if (action === 'continue-recall') return move(2);
    if (action === 'play-recall-word') {
      await play({ text: word.fa, phoneticHint: word.latin }, button, { kind: 'recall_word' });
      return;
    }
    if (action === 'check-recall' && lesson.recall.selected != null) {
      lesson.recall.submitted = true;
      lesson.recall.correct = lesson.recall.selected === todaysWordIndex();
      lesson.done.recall = lesson.recall.correct;
      track('recall_submitted', { correct: lesson.recall.correct });
      return render();
    }
    if (action === 'retry-recall') {
      lesson.recall = { selected: null, submitted: false, correct: false };
      lesson.done.recall = false;
      return render();
    }
    if (action === 'continue-script') return move(3);
    if (action === 'open-review') {
      showView('review');
      buildReviewQueue(false);
      return;
    }
    if (action === 'open-script') {
      track('script_started');
      showView('script');
      return;
    }
    if (action === 'done') {
      announce('You are done for today. Come back tomorrow for a new word.');
    }
  }

  document.addEventListener('click', event => {
    const back = event.target.closest?.(`#${ROOT_ID} .lesson-back`);
    if (!back) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    goBack();
  }, true);

  document.addEventListener('click', event => {
    if (!event.target.closest(`#${ROOT_ID}`)) return;
    const action = event.target.closest('[data-guided-action]');
    if (action) {
      handleAction(action);
      return;
    }
    const recall = event.target.closest('[data-guided-recall]');
    if (recall && !lesson.recall.submitted) {
      lesson.recall.selected = Number(recall.dataset.guidedRecall);
      render();
    }
  });

  document.addEventListener('farsi:script-completed', () => {
    lesson.done.script = true;
    completeLesson();
    showView('today');
  });

  document.getElementById('scriptBackBtn')?.addEventListener('click', () => {
    lesson.step = 2;
    save();
    showView('today');
  });

  const previousShowView = showView;
  showView = function showViewWithSpecToday(name) {
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
