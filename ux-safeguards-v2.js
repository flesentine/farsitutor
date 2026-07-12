// Focused safeguards for the standalone Script/Review screens and complete reset behavior.
(() => {
  const GUIDED_KEY = 'farsi-guided-today-v2';
  const SCRIPT_KEY = 'farsi-script-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';

  const read = (key, fallback = {}) => {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...fallback }; }
  };
  const localDayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  function currentLetterIndex() {
    return dayNumber() % SCRIPT_LESSONS.length;
  }

  function primarySound(sound) {
    return String(sound || '').toLowerCase().split(/[\s/(,]/).filter(Boolean)[0] || '';
  }

  function hasUniqueSound(index) {
    const key = primarySound(SCRIPT_LESSONS[index]?.sound);
    return SCRIPT_LESSONS.filter(lesson => primarySound(lesson.sound) === key).length === 1;
  }

  function meaningfulPracticeStreak() {
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
  }

  if (typeof streakDays === 'function') streakDays = meaningfulPracticeStreak;

  if (typeof showView === 'function') {
    const originalShowView = showView;
    showView = function preserveActiveReview(name) {
      if (name !== 'review') return originalShowView(name);
      document.querySelectorAll('.view').forEach(element => element.classList.toggle('active', element.id === 'reviewView'));
      document.querySelectorAll('.tab').forEach(element => element.classList.toggle('active', element.dataset.view === 'review'));
      const activeSession = Array.isArray(reviewQueue) && reviewQueue.length > 0 && reviewIndex < reviewQueue.length;
      if (!activeSession) buildReviewQueue(false);
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    #scriptView.ux-script-testing .script-card { display:none !important; }
    .script-quiz-card.ux-script-ready #scriptQuizPrompt,
    .script-quiz-card.ux-script-ready #scriptQuizChoices,
    .script-quiz-card.ux-script-ready #scriptQuizResult,
    .script-quiz-card.ux-script-ready #scriptNextQuizBtn { display:none !important; }
    .ux-start-script-quiz { width:100%; min-height:50px; margin-top:12px; }
  `;
  document.head.appendChild(style);

  function deterministicOrder(values, seed = 0) {
    return [...values].sort((left, right) => {
      const leftHash = (((left + 5) * 2654435761 + dayNumber() + seed) >>> 0);
      const rightHash = (((right + 5) * 2654435761 + dayNumber() + seed) >>> 0);
      return leftHash - rightHash;
    });
  }

  function sanitizeStandaloneChoices(questionType) {
    const targetIndex = currentLetterIndex();
    const target = SCRIPT_LESSONS[targetIndex];
    const buttons = [...document.querySelectorAll('#scriptQuizChoices [data-script-choice]')];
    if (!buttons.length || buttons.every(button => button.disabled)) return;

    const valid = index => {
      if (index === targetIndex) return false;
      const candidate = SCRIPT_LESSONS[index];
      if (questionType === 'sound') return primarySound(candidate.sound) !== primarySound(target.sound);
      if (questionType === 'example') return !String(target.exampleFa || '').includes(candidate.letter);
      return true;
    };

    const desired = [targetIndex, ...deterministicOrder(SCRIPT_LESSONS.map((_, index) => index).filter(valid), targetIndex).slice(0, 3)];
    const ordered = deterministicOrder(desired, 71);
    buttons.forEach((button, position) => {
      const index = ordered[position] ?? desired[position] ?? targetIndex;
      button.dataset.scriptChoice = String(index);
      button.textContent = SCRIPT_LESSONS[index].letter;
      button.lang = 'fa';
      button.dir = 'rtl';
      button.removeAttribute('aria-label');
    });
  }

  function prepareStandaloneScriptQuiz() {
    const view = document.getElementById('scriptView');
    const card = view?.querySelector('.script-quiz-card:not(.script-review-card)');
    const prompt = document.getElementById('scriptQuizPrompt');
    const choices = [...(card?.querySelectorAll('[data-script-choice]') || [])];
    if (!view || !card || !prompt || !choices.length) return;

    const lesson = SCRIPT_LESSONS[currentLetterIndex()];
    let questionType = 'name';
    const originalText = prompt.textContent || '';
    if (originalText.includes('appears in')) {
      questionType = 'example';
      prompt.innerHTML = `Which letter appears in <span lang="fa" dir="rtl">${escapeHTML(lesson.exampleFa)}</span> (${escapeHTML(lesson.exampleLatin)}, ${escapeHTML(lesson.exampleEn)})?`;
    } else if (originalText.includes('makes the') && hasUniqueSound(currentLetterIndex())) {
      questionType = 'sound';
    } else if (originalText.includes('makes the')) {
      questionType = 'name';
      prompt.textContent = `Which letter is called “${lesson.name}”?`;
    }
    sanitizeStandaloneChoices(questionType);

    const answered = choices.every(choice => choice.disabled);
    if (answered) {
      card.classList.remove('ux-script-ready');
      view.classList.remove('ux-script-testing');
      card.querySelector('.ux-start-script-quiz')?.remove();
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
    if (!card.querySelector('.ux-start-script-quiz')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary-btn ux-start-script-quiz';
      button.dataset.uxAction = 'start-script-quiz';
      button.textContent = 'Start quiz';
      card.appendChild(button);
    }
  }

  document.addEventListener('click', event => {
    const start = event.target.closest('[data-ux-action="start-script-quiz"]');
    if (!start) return;
    localStorage.setItem(`${STUDIED_PREFIX}${todayKey()}`, '1');
    const card = start.closest('.script-quiz-card');
    if (card) card.dataset.uxQuizStarted = 'true';
    card?.classList.remove('ux-script-ready');
    document.getElementById('scriptView')?.classList.add('ux-script-testing');
    start.remove();
  }, true);

  const quizChoices = document.getElementById('scriptQuizChoices');
  if (quizChoices) {
    const observer = new MutationObserver(prepareStandaloneScriptQuiz);
    observer.observe(quizChoices, { childList: true });
  }
  window.setTimeout(prepareStandaloneScriptQuiz, 0);

  const resetButton = document.getElementById('resetBtn');
  resetButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!window.confirm('Reset all saved words, lesson progress, script progress, and review history?')) return;
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('farsi-')) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
    window.location.reload();
  }, true);

  if (typeof renderStats === 'function') renderStats();
})();
