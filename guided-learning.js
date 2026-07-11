(() => {
  const TASK_KEY = 'farsi-daily-guided-v1';

  function ensureUxStylesheet() {
    if (document.querySelector('link[data-farsi-ux-polish]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './ux-polish.css?v=1';
    link.dataset.farsiUxPolish = 'true';
    document.head.appendChild(link);
  }

  function loadTaskState() {
    try {
      return JSON.parse(localStorage.getItem(TASK_KEY) || '{}');
    } catch {
      return {};
    }
  }

  let taskState = loadTaskState();

  function saveTaskState() {
    localStorage.setItem(TASK_KEY, JSON.stringify(taskState));
  }

  function todayTasks() {
    const key = todayKey();
    if (!taskState[key]) {
      taskState[key] = {
        wordHeard: false,
        sentenceHeard: false,
        reviewTarget: Math.min(4, dueCardIndexes().length)
      };
      saveTaskState();
    }
    return taskState[key];
  }

  function setTaskFlag(name, value = true) {
    todayTasks()[name] = value;
    saveTaskState();
    renderDailyGuide();
  }

  function scriptCompletedToday() {
    try {
      const script = JSON.parse(localStorage.getItem('farsi-script-v1') || '{}');
      return Boolean(script.completed?.[todayKey()]);
    } catch {
      return false;
    }
  }

  function reviewedToday() {
    return Number(state.history?.[todayKey()]?.reviewed || 0);
  }

  function taskSnapshot() {
    const tasks = todayTasks();
    const target = Number(tasks.reviewTarget || 0);
    const reviewed = reviewedToday();
    return [
      { id: 'word', label: 'Learn today’s word', detail: tasks.wordHeard ? 'Word heard and started' : 'Hear it once, then say it aloud', done: Boolean(tasks.wordHeard), icon: '1' },
      { id: 'sentence', label: 'Hear and repeat the sentence', detail: tasks.sentenceHeard ? 'Sentence practice complete' : 'Listen to the full phrase', done: Boolean(tasks.sentenceHeard), icon: '2' },
      { id: 'script', label: 'Complete today’s script quiz', detail: scriptCompletedToday() ? 'Letter quiz complete' : 'One letter and a quick question', done: scriptCompletedToday(), icon: '3' },
      { id: 'review', label: target ? `Review ${target} due card${target === 1 ? '' : 's'}` : 'Reviews are caught up', detail: target ? `${Math.min(reviewed, target)} of ${target} complete` : 'Nothing else is due today', done: target === 0 || reviewed >= target, icon: '4' }
    ];
  }

  function ensureDailyGuide() {
    if ($('dailyGuide')) return;
    const hero = document.querySelector('#todayView .hero-copy');
    if (!hero) return;
    const guide = document.createElement('section');
    guide.id = 'dailyGuide';
    guide.className = 'daily-guide';
    guide.setAttribute('aria-labelledby', 'dailyGuideTitle');
    guide.innerHTML = `
      <div class="daily-guide-summary">
        <div><p class="eyebrow">YOUR DAILY PLAN</p><h3 id="dailyGuideTitle">A few focused minutes</h3><p id="dailyGuideStatus" class="daily-guide-status"></p></div>
        <div id="dailyProgressRing" class="daily-progress-ring" role="img" aria-label="Daily progress"><span id="dailyProgressText">0/4</span></div>
      </div>
      <div id="dailyTaskList" class="daily-task-list"></div>
      <button id="continueDailyBtn" class="primary-btn daily-continue" type="button">Continue</button>
    `;
    hero.insertAdjacentElement('afterend', guide);
  }

  function renderDailyGuide() {
    ensureDailyGuide();
    const list = $('dailyTaskList');
    if (!list) return;
    const tasks = taskSnapshot();
    const complete = tasks.filter(task => task.done).length;
    const firstIncomplete = tasks.find(task => !task.done);
    $('dailyProgressText').textContent = `${complete}/${tasks.length}`;
    $('dailyProgressRing').style.setProperty('--daily-progress', `${(complete / tasks.length) * 360}deg`);
    $('dailyProgressRing').setAttribute('aria-label', `${complete} of ${tasks.length} daily activities complete`);
    $('dailyGuideStatus').textContent = complete === tasks.length ? 'Daily lesson complete. Nice work.' : `${tasks.length - complete} quick step${tasks.length - complete === 1 ? '' : 's'} left today.`;
    $('dailyGuide').classList.toggle('complete', complete === tasks.length);
    $('continueDailyBtn').textContent = complete === tasks.length ? 'Review today’s word again' : `Continue: ${firstIncomplete.label}`;
    $('continueDailyBtn').dataset.dailyTask = firstIncomplete?.id || 'word';
    list.innerHTML = tasks.map(task => `
      <button type="button" class="daily-task${task.done ? ' done' : ''}${task.id === firstIncomplete?.id ? ' next' : ''}" data-daily-task="${task.id}" aria-label="${escapeHTML(task.label)}${task.done ? ', complete' : ''}">
        <span class="daily-task-check" aria-hidden="true">${task.done ? '✓' : task.icon}</span>
        <span class="daily-task-copy"><strong>${escapeHTML(task.label)}</strong><small>${escapeHTML(task.detail)}</small></span>
        <span class="daily-task-arrow" aria-hidden="true">${task.done ? '' : '›'}</span>
      </button>
    `).join('');
  }

  function goToTask(id) {
    if (id === 'script') {
      showView('script');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (id === 'review') {
      showView('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    showView('today');
    const target = id === 'sentence' ? $('speakSentenceBtn') : $('speakTodayBtn');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.click();
    window.setTimeout(() => target?.focus(), 250);
  }

  function verbEnglishPhrase(value) {
    return String(value || '').replace(/^to\s+/i, '');
  }

  function renderFullConjugations(verb) {
    const labels = { present: 'Present', past: 'Past', subjunctive: 'Subjunctive', future: 'Future' };
    const help = { present: 'I go / I am going', past: 'I went', subjunctive: 'that I go / let me go', future: 'I will go' };
    const tables = Object.entries(labels).map(([tense], tableIndex) => `
      <section class="conjugation-tense${tableIndex === 0 ? ' active' : ''}" data-tense-panel="${tense}">
        <p class="tense-help">${help[tense]}</p>
        ${verb[tense].map((form, index) => `<div class="conjugation-row"><span class="conjugation-pronoun" lang="fa" dir="rtl">${escapeHTML(verb.pronouns[index])}</span><strong lang="fa" dir="rtl">${escapeHTML(form)}</strong><button type="button" class="conjugation-speak" data-speak-form="${escapeHTML(form)}" aria-label="Hear ${escapeHTML(form)}">🔊</button></div>`).join('')}
      </section>
    `).join('');
    return `<div class="tense-tabs" role="tablist" aria-label="Verb tense">${Object.entries(labels).map(([tense, label], index) => `<button type="button" data-tense="${tense}" class="${index === 0 ? 'active' : ''}">${label}</button>`).join('')}</div><div class="conjugation-tables">${tables}</div>`;
  }

  renderVerbDetails = function renderBeginnerVerbDetails(containerId, word) {
    const container = $(containerId);
    if (!container) return;
    const key = word?.verbKey || (word?.pos === 'verb' ? word.fa : null);
    const verb = key && typeof getVerbConjugations === 'function' ? getVerbConjugations(key) : null;
    container.classList.toggle('hidden', !verb);
    if (!verb) {
      container.innerHTML = '';
      return;
    }
    const usefulForm = verb.present[0];
    const english = verbEnglishPhrase(verb.en);
    const phraseFa = word.exFa || `من ${usefulForm}.`;
    const phraseLatin = word.exLatin || '';
    const phraseEn = word.exEn || `I ${english}.`;
    container.innerHTML = `
      <div class="beginner-verb">
        <div class="beginner-verb-heading"><div><span class="verb-label">USEFUL VERB TODAY</span><strong lang="fa" dir="rtl">${escapeHTML(verb.infinitive)}</strong><span>${escapeHTML(verb.latin)} · ${escapeHTML(verb.en)}</span></div></div>
        <div class="verb-useful-grid">
          <article class="verb-useful-card"><small>Useful now</small><strong lang="fa" dir="rtl">${escapeHTML(usefulForm)}</strong><span>I ${escapeHTML(english)}</span><button type="button" class="verb-practice-audio" data-guide-speak="${escapeHTML(usefulForm)}" aria-label="Hear useful verb form">🔊 Hear it</button></article>
          <article class="verb-useful-card phrase"><small>Say it in a sentence</small><strong lang="fa" dir="rtl">${escapeHTML(phraseFa)}</strong>${phraseLatin ? `<span class="verb-phrase-latin">${escapeHTML(phraseLatin)}</span>` : ''}<span>${escapeHTML(phraseEn)}</span><button type="button" class="verb-practice-audio" data-guide-speak="${escapeHTML(phraseFa)}" data-guide-hint="${escapeHTML(phraseLatin)}" aria-label="Hear example sentence">🔊 Hear phrase</button></article>
        </div>
        <details class="full-conjugations"><summary>View all conjugations</summary><div class="full-conjugations-body">${renderFullConjugations(verb)}</div></details>
      </div>
    `;
  };

  function ensurePronunciationLabs() {
    if (!$('todayPronunciationLab')) {
      const example = document.querySelector('#todayCard .example-box');
      const lab = document.createElement('section');
      lab.id = 'todayPronunciationLab';
      lab.className = 'pronunciation-lab';
      lab.innerHTML = `
        <div class="pronunciation-lab-heading"><div><strong>Pronunciation practice</strong><span>Listen, pause, and repeat aloud.</span></div><span aria-hidden="true">🎧</span></div>
        <div class="pronunciation-actions">
          <button type="button" data-audio-mode="slow-word"><strong>Slow word</strong><span>Hear each sound</span></button>
          <button type="button" data-audio-mode="slow-sentence"><strong>Slow sentence</strong><span>Follow the phrase</span></button>
          <button type="button" data-audio-mode="repeat-word"><strong>Repeat ×3</strong><span>Build muscle memory</span></button>
          <button type="button" data-audio-mode="word-sentence"><strong>Word → sentence</strong><span>Practice in context</span></button>
        </div>
        <p id="todaySpeechStatus" class="speech-status" role="status" aria-live="polite">Tap an option to begin.</p>
      `;
      example?.insertAdjacentElement('afterend', lab);
    }
    if (!$('reviewPronunciationLab')) {
      const example = $('reviewExampleBox');
      const lab = document.createElement('section');
      lab.id = 'reviewPronunciationLab';
      lab.className = 'pronunciation-lab review-pronunciation-lab';
      lab.innerHTML = `<div class="pronunciation-actions"><button type="button" data-review-audio-mode="slow-word"><strong>Slow answer</strong><span>Hear each sound</span></button><button type="button" data-review-audio-mode="repeat-word"><strong>Repeat ×3</strong><span>Say it aloud</span></button><button type="button" data-review-audio-mode="word-sentence"><strong>Word → sentence</strong><span>Use it in context</span></button></div><p id="reviewSpeechStatus" class="speech-status" role="status" aria-live="polite"></p>`;
      example?.insertAdjacentElement('afterend', lab);
    }
  }

  function practiceSentenceFor(word) {
    if (word?.exFa) return { text: word.exFa, phoneticHint: word.exLatin || '' };
    return { text: `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`, phoneticHint: `Man kalame-ye “${word.latin}” râ yâd migiram.` };
  }

  async function playMode(mode, button, word, updateDaily = true) {
    const wordItem = { text: word.fa, phoneticHint: word.latin || '' };
    const sentenceItem = practiceSentenceFor(word);
    let ok = false;
    if (mode === 'slow-word') {
      ok = await speakPractice([wordItem], button, { speed: 'slow' });
      if (ok && updateDaily) setTaskFlag('wordHeard');
    } else if (mode === 'slow-sentence') {
      ok = await speakPractice([sentenceItem], button, { speed: 'slow' });
      if (ok && updateDaily) setTaskFlag('sentenceHeard');
    } else if (mode === 'repeat-word') {
      ok = await speakPractice([wordItem], button, { repeat: 3, pauseMs: 550 });
      if (ok && updateDaily) setTaskFlag('wordHeard');
    } else if (mode === 'word-sentence') {
      ok = await speakPractice([wordItem, sentenceItem], button, { pauseMs: 800 });
      if (ok && updateDaily) {
        setTaskFlag('wordHeard');
        setTaskFlag('sentenceHeard');
      }
    }
    return ok;
  }

  function updateSpeechStatus(message, isError = false, review = false) {
    const el = review ? $('reviewSpeechStatus') : $('todaySpeechStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', isError);
  }

  document.addEventListener('click', event => {
    const taskButton = event.target.closest('[data-daily-task]');
    if (taskButton) goToTask(taskButton.dataset.dailyTask);
    const audioButton = event.target.closest('[data-audio-mode]');
    if (audioButton) playMode(audioButton.dataset.audioMode, audioButton, getWord(todaysWordIndex()));
    const reviewAudioButton = event.target.closest('[data-review-audio-mode]');
    if (reviewAudioButton && reviewQueue[reviewIndex] !== undefined) playMode(reviewAudioButton.dataset.reviewAudioMode, reviewAudioButton, getWord(reviewQueue[reviewIndex]), false);
    const guideSpeak = event.target.closest('[data-guide-speak]');
    if (guideSpeak) speak(guideSpeak.dataset.guideSpeak, guideSpeak, guideSpeak.dataset.guideHint || '');
  });

  document.addEventListener('farsi:speech-start', event => {
    const button = event.detail?.button;
    updateSpeechStatus('Playing…', false, Boolean(button?.closest('#reviewView')));
  });
  document.addEventListener('farsi:speech-complete', event => {
    const button = event.detail?.button;
    if (button?.id === 'speakTodayBtn') setTaskFlag('wordHeard');
    if (button?.id === 'speakSentenceBtn') setTaskFlag('sentenceHeard');
    updateSpeechStatus('Played successfully.', false, Boolean(button?.closest('#reviewView')));
  });
  document.addEventListener('farsi:speech-error', event => {
    const button = event.detail?.button;
    updateSpeechStatus('Couldn’t play. Try the slow option or check media volume.', true, Boolean(button?.closest('#reviewView')));
  });

  $('scriptQuizChoices')?.addEventListener('click', () => window.setTimeout(renderDailyGuide, 0));
  $('resetBtn')?.addEventListener('click', () => window.setTimeout(() => {
    if (!Object.keys(state.cards || {}).length) {
      delete taskState[todayKey()];
      saveTaskState();
      renderDailyGuide();
    }
  }, 0));

  const originalRateCard = rateCard;
  rateCard = function rateCardWithGuide(result) {
    originalRateCard(result);
    renderDailyGuide();
  };

  const originalRenderReviewCard = renderReviewCard;
  renderReviewCard = function renderReviewCardWithUx() {
    originalRenderReviewCard();
    const hasCard = reviewQueue.length > 0 && reviewIndex < reviewQueue.length;
    if (!hasCard) return;
    $('speakReviewBtn')?.classList.add('hidden');
    $('reviewProgressFill').style.width = `${((reviewIndex + 1) / reviewQueue.length) * 100}%`;
    const direction = $('reviewDirection')?.textContent || '';
    $('revealBtn').textContent = direction.startsWith('Persian script') ? 'Show meaning' : 'Show Persian';
    updateSpeechStatus('', false, true);
  };

  $('revealBtn')?.addEventListener('click', () => {
    $('speakReviewBtn')?.classList.remove('hidden');
    window.setTimeout(() => $('reviewAnswer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  });

  ensureUxStylesheet();
  ensureDailyGuide();
  ensurePronunciationLabs();
  renderAll();
  renderDailyGuide();
})();
