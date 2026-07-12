// Learning-flow safeguards for answer integrity, progress accuracy, and mobile continuity.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const LETTER_REVIEW_KEY = 'farsi-script-review-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';

  const read = (key, fallback = {}) => {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...fallback }; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const localDayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const currentDay = () => typeof todayKey === 'function' ? todayKey() : localDayKey();
  const escape = value => typeof escapeHTML === 'function'
    ? escapeHTML(value)
    : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function requirePreviousLetterReview() {
    const key = currentDay();
    const guided = read(GUIDED_KEY, { days: {} });
    const day = guided.days?.[key];
    if (!day?.done?.script) return;
    const reviews = read(LETTER_REVIEW_KEY, { daily: {} });
    if ((reviews.daily?.[key]?.attempts || 0) > 0) return;
    day.done.script = false;
    day.completedAt = null;
    if (Number(day.step) > 3) day.step = 3;
    write(GUIDED_KEY, guided);
  }

  requirePreviousLetterReview();

  if (typeof streakDays === 'function') {
    streakDays = function meaningfulPracticeStreak() {
      const guided = read(GUIDED_KEY, { days: {} });
      const script = read(SCRIPT_KEY, { completed: {} });
      let count = 0;
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      for (let offset = 0; offset < 3650; offset += 1) {
        const key = localDayKey(cursor);
        const practiced = Boolean(
          guided.days?.[key]?.completedAt ||
          Number(state?.history?.[key]?.reviewed || 0) > 0 ||
          script.completed?.[key]
        );
        if (practiced) count += 1;
        else if (offset !== 0) break;
        cursor.setDate(cursor.getDate() - 1);
      }
      return count;
    };
  }

  if (typeof showView === 'function') {
    const originalShowView = showView;
    showView = function preserveReviewSession(name) {
      if (name !== 'review') return originalShowView(name);
      document.querySelectorAll('.view').forEach(element => element.classList.toggle('active', element.id === 'reviewView'));
      document.querySelectorAll('.tab').forEach(element => element.classList.toggle('active', element.dataset.view === 'review'));
      const activeSession = Array.isArray(reviewQueue) && reviewQueue.length > 0 && reviewIndex < reviewQueue.length;
      if (!activeSession) buildReviewQueue(false);
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    .ux-letter-study .guided-letter-choices,
    .ux-letter-study > p:not(.guided-feedback),
    .ux-letter-study > .guided-letter,
    .ux-letter-study > h3 { display:none !important; }
    .ux-letter-study-panel { display:grid; gap:8px; text-align:center; }
    .ux-letter-study-panel .ux-study-letter { font-family:Tahoma,Arial,sans-serif; font-size:clamp(92px,25vw,132px); line-height:1.05; }
    .ux-letter-study-panel h3 { display:block !important; margin:0; }
    .ux-study-forms { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin:8px 0; }
    .ux-study-forms div { padding:9px 4px; border:1px solid var(--border); border-radius:13px; background:#f7f5fc; }
    .ux-study-forms small,.ux-study-forms strong { display:block; }
    .ux-study-forms strong { margin-top:3px; font-family:Tahoma,Arial,sans-serif; font-size:25px; }
    .ux-study-example { padding:12px; border-radius:16px; background:var(--primary-soft); }
    .ux-study-example strong,.ux-study-example span { display:block; }
    .ux-study-example strong { font-family:Tahoma,Arial,sans-serif; font-size:35px; }
    #scriptView.ux-script-testing .script-card { display:none !important; }
    .script-quiz-card.ux-script-ready #scriptQuizPrompt,
    .script-quiz-card.ux-script-ready #scriptQuizChoices,
    .script-quiz-card.ux-script-ready #scriptQuizResult,
    .script-quiz-card.ux-script-ready #scriptNextQuizBtn { display:none !important; }
    .ux-start-quiz { width:100%; min-height:50px; margin-top:12px; }
    .ux-done-word { margin:12px 0; padding:14px; border-radius:18px; background:var(--primary-soft); }
    .ux-done-word strong,.ux-done-word span { display:block; }
    .ux-done-word strong { font-family:Tahoma,Arial,sans-serif; font-size:42px; }
    @media(max-width:420px){ .ux-study-forms{grid-template-columns:1fr 1fr;} }
  `;
  document.head.appendChild(style);

  function currentLetterIndex() {
    return typeof dayNumber === 'function' && Array.isArray(SCRIPT_LESSONS) && SCRIPT_LESSONS.length
      ? dayNumber() % SCRIPT_LESSONS.length
      : 0;
  }

  function studyTodayLetter(card) {
    const choices = [...card.querySelectorAll('.guided-letter-choice[data-kind="today"]')];
    if (!choices.length || choices.every(choice => choice.disabled)) return;
    const key = `${STUDIED_PREFIX}${currentDay()}`;
    if (localStorage.getItem(key) === '1') return;
    if (card.querySelector('.ux-letter-study-panel')) return;
    const lesson = SCRIPT_LESSONS[currentLetterIndex()];
    if (!lesson) return;
    card.classList.add('ux-letter-study');
    const panel = document.createElement('section');
    panel.className = 'ux-letter-study-panel';
    panel.innerHTML = `
      <span class="guided-kicker">LEARN TODAY’S LETTER</span>
      <div class="ux-study-letter" lang="fa" dir="rtl">${escape(lesson.letter)}</div>
      <h3>${escape(lesson.name)} · Sound “${escape(lesson.sound)}”</h3>
      <div class="ux-study-forms" aria-label="Letter forms">
        ${['Alone','Start','Middle','End'].map((label, index) => `<div><small>${label}</small><strong lang="fa" dir="rtl">${escape(lesson.forms?.[index] || lesson.letter)}</strong></div>`).join('')}
      </div>
      <div class="ux-study-example"><small>Example word</small><strong lang="fa" dir="rtl">${escape(lesson.exampleFa)}</strong><span>${escape(lesson.exampleLatin)} · ${escape(lesson.exampleEn)}</span></div>
      <button type="button" class="primary-btn guided-primary" data-ux-action="start-guided-letter-quiz">Test me on this letter</button>
    `;
    card.insertBefore(panel, card.children[1] || null);
  }

  function prepareStandaloneScriptQuiz() {
    const view = document.getElementById('scriptView');
    const card = view?.querySelector('.script-quiz-card:not(.script-review-card)');
    const choices = [...(card?.querySelectorAll('[data-script-choice]') || [])];
    if (!card || !choices.length) return;
    choices.forEach(choice => {
      choice.removeAttribute('aria-label');
      choice.lang = 'fa';
      choice.dir = 'rtl';
    });
    const answered = choices.every(choice => choice.disabled);
    if (answered) {
      card.classList.remove('ux-script-ready');
      view.classList.remove('ux-script-testing');
      card.querySelector('.ux-start-quiz')?.remove();
      card.dataset.uxQuizStarted = 'false';
      return;
    }
    if (card.dataset.uxQuizStarted === 'true') {
      view.classList.add('ux-script-testing');
      card.classList.remove('ux-script-ready');
      return;
    }
    view.classList.remove('ux-script-testing');
    card.classList.add('ux-script-ready');
    if (!card.querySelector('.ux-start-quiz')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary-btn ux-start-quiz';
      button.dataset.uxAction = 'start-script-quiz';
      button.textContent = 'Start quiz without the answer showing';
      card.appendChild(button);
    }
  }

  function fixExamplePrompt(element) {
    const text = element?.textContent || '';
    if (!text.includes('appears in')) return;
    const lesson = SCRIPT_LESSONS.find(item => text.includes(item.exampleLatin) || text.includes(item.exampleEn));
    if (!lesson || text.includes(lesson.exampleFa)) return;
    element.innerHTML = `Which letter appears in <span lang="fa" dir="rtl">${escape(lesson.exampleFa)}</span> (${escape(lesson.exampleLatin)}, ${escape(lesson.exampleEn)})?`;
  }

  function enhanceSentenceCard() {
    const card = document.querySelector('#guidedTodayV1 .guided-card');
    if (!card?.querySelector('[data-action="play-sentence"]')) return;
    const secondaryReplay = card.querySelector('.guided-inline [data-action="play-sentence"]');
    if (secondaryReplay) secondaryReplay.hidden = !card.querySelector('.guided-say');
  }

  function enhanceDoneCard() {
    const card = document.querySelector('#guidedTodayV1 .guided-card');
    if (!card?.querySelector('.guided-done')) return;
    const replay = card.querySelector('[data-action="replay"]');
    if (!replay) return;
    const current = getWord(todaysWordIndex());
    if (!card.querySelector('.ux-done-word')) {
      const summary = document.createElement('div');
      summary.className = 'ux-done-word';
      summary.innerHTML = `<strong lang="fa" dir="rtl">${escape(current.fa)}</strong><span>${escape(current.latin)} · ${escape(current.en)}</span>`;
      replay.before(summary);
    }
    replay.removeAttribute('data-action');
    replay.dataset.uxAction = 'play-done-word';
    replay.textContent = '🔊 Hear today’s word again';
  }

  function relabelProgress() {
    document.querySelectorAll('.guided-stats span').forEach(label => {
      if (label.textContent.trim() === 'accuracy') label.textContent = 'review success';
    });
  }

  function auditDom() {
    document.querySelectorAll('#guidedTodayV1 .guided-card').forEach(studyTodayLetter);
    prepareStandaloneScriptQuiz();
    fixExamplePrompt(document.getElementById('scriptQuizPrompt'));
    fixExamplePrompt(document.getElementById('pastScriptPrompt'));
    enhanceSentenceCard();
    enhanceDoneCard();
    relabelProgress();
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-ux-action]');
    if (!action) return;
    if (action.dataset.uxAction === 'start-guided-letter-quiz') {
      localStorage.setItem(`${STUDIED_PREFIX}${currentDay()}`, '1');
      const card = action.closest('.guided-card');
      card?.classList.remove('ux-letter-study');
      card?.querySelector('.ux-letter-study-panel')?.remove();
      return;
    }
    if (action.dataset.uxAction === 'start-script-quiz') {
      const card = action.closest('.script-quiz-card');
      card.dataset.uxQuizStarted = 'true';
      card.classList.remove('ux-script-ready');
      document.getElementById('scriptView')?.classList.add('ux-script-testing');
      action.remove();
      return;
    }
    if (action.dataset.uxAction === 'play-done-word') {
      event.preventDefault();
      event.stopPropagation();
      const current = getWord(todaysWordIndex());
      speakPractice([{ text: current.fa, phoneticHint: current.latin }], action);
    }
  }, true);

  document.addEventListener('farsi:speech-complete', event => {
    const button = event.detail?.button;
    const action = button?.dataset?.action;
    if (!['repeat-sentence', 'word-sentence'].includes(action)) return;
    if (action === 'repeat-sentence') {
      const completedRepeats = Number(button.dataset.uxCompletedRepeats || 0) + 1;
      button.dataset.uxCompletedRepeats = String(completedRepeats);
      if (completedRepeats < 3) return;
      delete button.dataset.uxCompletedRepeats;
    }
    const guided = read(GUIDED_KEY, { days: {} });
    const day = guided.days?.[currentDay()];
    if (day) {
      day.sentencePlayed = true;
      write(GUIDED_KEY, guided);
    }
    const card = button.closest('.guided-card');
    if (!card) return;
    if (!card.querySelector('.guided-say')) {
      const prompt = document.createElement('p');
      prompt.className = 'guided-say';
      prompt.textContent = 'Say it aloud once.';
      button.closest('.guided-more')?.before(prompt);
    }
    if (!card.querySelector('[data-action="continue-recall"]')) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'secondary-btn guided-secondary';
      next.dataset.action = 'continue-recall';
      next.textContent = 'Continue to quick check';
      button.closest('.guided-more')?.before(next);
    }
    enhanceSentenceCard();
  });

  document.addEventListener('click', event => {
    const choice = event.target.closest('.guided-letter-choice[data-kind="today"]');
    if (!choice) return;
    const selected = Number(choice.dataset.letter);
    window.setTimeout(() => {
      if (selected === currentLetterIndex()) return;
      const script = read(SCRIPT_KEY, { completed: {} });
      if (script.completed) delete script.completed[currentDay()];
      write(SCRIPT_KEY, script);
    }, 0);
  }, true);

  const observer = new MutationObserver(auditDom);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setTimeout(auditDom, 0);
})();
