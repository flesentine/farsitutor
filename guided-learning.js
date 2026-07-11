(() => {
  const TASK_KEY = 'farsi-daily-guided-v1';

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
      {
        id: 'word',
        label: 'Learn today’s word',
        detail: tasks.wordHeard ? 'Word heard and started' : 'Hear it once, then say it aloud',
        done: Boolean(tasks.wordHeard),
        icon: '1'
      },
      {
        id: 'sentence',
        label: 'Hear and repeat the sentence',
        detail: tasks.sentenceHeard ? 'Sentence practice complete' : 'Listen to the full phrase',
        done: Boolean(tasks.sentenceHeard),
        icon: '2'
      },
      {
        id: 'script',
        label: 'Complete today’s script quiz',
        detail: scriptCompletedToday() ? 'Letter quiz complete' : 'One letter and a quick question',
        done: scriptCompletedToday(),
        icon: '3'
      },
      {
        id: 'review',
        label: target ? `Review ${target} due card${target === 1 ? '' : 's'}` : 'Reviews are caught up',
        detail: target ? `${Math.min(reviewed, target)} of ${target} complete` : 'Nothing else is due today',
        done: target === 0 || reviewed >= target,
        icon: '4'
      }
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
        <div>
          <p class="eyebrow">YOUR DAILY PLAN</p>
          <h3 id="dailyGuideTitle">A few focused minutes</h3>
          <p id="dailyGuideStatus" class="daily-guide-status"></p>
        </div>
        <div id="dailyProgressRing" class="daily-progress-ring" role="img" aria-label="Daily progress">
          <span id="dailyProgressText">0/4</span>
        </div>
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
    $('dailyGuideStatus').textContent = complete === tasks.length
      ? 'Daily lesson complete. Nice work.'
      : `${tasks.length - complete} quick step${tasks.length - complete === 1 ? '' : 's'} left today.`;
    $('dailyGuide').classList.toggle('complete', complete === tasks.length);
    $('continueDailyBtn').textContent = complete === tasks.length ? 'Review today’s word again' : `Continue: ${firstIncomplete.label}`;
    $('continueDailyBtn').dataset.dailyTask = firstIncomplete?.id || 'word';
    list.innerHTML = tasks.map(task => `
      <button type="button" class="daily-task${task.done ? ' done' : ''}" data-daily-task="${task.id}" aria-label="${escapeHTML(task.label)}${task.done ? ', complete' : ''}">
        <span class="daily-task-check" aria-hidden="true">${task.done ? '✓' : task.icon}</span>
        <span class="daily-task-copy"><strong>${escapeHTML(task.label)}</strong><small>${escapeHTML(task.detail)}</small></span>
        <span class="daily-task-arrow" aria-hidden="true">${task.done ? '' : '›'}</span>
      </button>
    `).join('');
  }

  function setTaskFlag(name, value = true) {
    todayTasks()[name] = value;
    saveTaskState();
    renderDailyGuide();
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
    setTimeout(() => target?.focus(), 350);
  }

  function verbEnglishPhrase(value) {
    return String(value || '').replace(/^to\s+/i, '');
  }

  function renderFullConjugations(verb) {
    const labels = { present: 'Present', past: 'Past', subjunctive: 'Subjunctive', future: 'Future' };
    const help = {
      present: 'I go / I am going',
      past: 'I went',
      subjunctive: 'that I go / let me go',
      future: 'I will go'
    };
    const tables = Object.entries(labels).map(([tense], tableIndex) => `
      <section class="conjugation-tense${tableIndex === 0 ? ' active' : ''}" data-tense-panel="${tense}">
        <p class="tense-help">${help[tense]}</p>
        ${verb[tense].map((form, index) => `
          <div class="conjugation-row">
            <span class="conjugation-pronoun" lang="fa" dir="rtl">${escapeHTML(verb.pronouns[index])}</span>
            <strong lang="fa" dir="rtl">${escapeHTML(form)}</strong>
            <button type="button" class="conjugation-speak" data-speak-form="${escapeHTML(form)}" aria-label="Hear ${escapeHTML(form)}">🔊</button>
          </div>
        `).join('')}
      </section>
    `).join('');
    return `
      <div class="tense-tabs" role="tablist" aria-label="Verb tense">
        ${Object.entries(labels).map(([tense, label], index) => `
          <button type="button" data-tense="${tense}" class="${index === 0 ? 'active' : ''}">${label}</button>
        `).join('')}
      </div>
      <div class="conjugation-tables">${tables}</div>
    `;
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
        <div class="beginner-verb-heading">
          <div>
            <span class="verb-label">USEFUL VERB TODAY</span>
            <strong lang="fa" dir="rtl">${escapeHTML(verb.infinitive)}</strong>
            <span>${escapeHTML(verb.latin)} · ${escapeHTML(verb.en)}</span>
          </div>
        </div>
        <div class="verb-useful-grid">
          <article class="verb-useful-card">
            <small>Useful now</small>
            <strong lang="fa" dir="rtl">${escapeHTML(usefulForm)}</strong>
            <span>I ${escapeHTML(english)}</span>
            <button type="button" class="verb-practice-audio" data-guide-speak="${escapeHTML(usefulForm)}" aria-label="Hear useful verb form">🔊 Hear it</button>
          </article>
          <article class="verb-useful-card phrase">
            <small>Say it in a sentence</small>
            <strong lang="fa" dir="rtl">${escapeHTML(phraseFa)}</strong>
            ${phraseLatin ? `<span class="verb-phrase-latin">${escapeHTML(phraseLatin)}</span>` : ''}
            <span>${escapeHTML(phraseEn)}</span>
            <button type="button" class="verb-practice-audio" data-guide-speak="${escapeHTML(phraseFa)}" data-guide-hint="${escapeHTML(phraseLatin)}" aria-label="Hear example sentence">🔊 Hear phrase</button>
          </article>
        </div>
        <details class="full-conjugations">
          <summary>View all conjugations</summary>
          <div class="full-conjugations-body">${renderFullConjugations(verb)}</div>
        </details>
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
        <div class="pronunciation-lab-heading">
          <div><strong>Pronunciation practice</strong><span>Listen, pause, and repeat aloud.</span></div>
          <span aria-hidden="true">🎧</span>
        </div>
        <div class="pronunciation-actions">
          <button type="button" data-audio-mode="slow-word"><strong>Slow word</strong><span>Hear each sound</span></button>
          <button type="button" data-audio-mode="slow-sentence"><strong>Slow sentence</strong><span>Follow the phrase</span></button>
          <button type="button" data-audio-mode="repeat-word"><strong>Repeat ×3</strong><span>Build muscle memory</span></button>
          <button type="button" data-audio-mode="word-sentence"><strong>Word → sentence</strong><span>Practice in context</span></button>
        </div>
      `;
      example?.insertAdjacentElement('afterend', lab);
    }

    if (!$('reviewPronunciationLab')) {
      const example = $('reviewExampleBox');
      const lab = document.createElement('section');
      lab.id = 'reviewPronunciationLab';
      lab.className = 'pronunciation-lab review-pronunciation-lab';
      lab.innerHTML = `
        <div class="pronunciation-actions">
          <button type="button" data-review-audio-mode="slow-word"><strong>Slow answer</strong><span>Hear each sound</span></button>
          <button type="button" data-review-audio-mode="repeat-word"><strong>Repeat ×3</strong><span>Say it aloud</span></button>
          <button type="button" data-review-audio-mode="word-sentence"><strong>Word → sentence</strong><span>Use it in context</span></button>
        </div>
      `;
      example?.insertAdjacentElement('afterend', lab);
    }
  }

  function practiceSentenceFor(word) {
    if (word?.exFa) return { text: word.exFa, phoneticHint: word.exLatin || '' };
    return {
      text: `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`,
      phoneticHint: `Man kalame-ye “${word.latin}” râ yâd migiram.`
    };
  }

  function playMode(mode, button, word, updateDaily = true) {
    const wordItem = { text: word.fa, phoneticHint: word.latin || '' };
    const sentenceItem = practiceSentenceFor(word);
    if (mode === 'slow-word') {
      if (updateDaily) setTaskFlag('wordHeard');
      speakPractice([wordItem], button, { speed: 'slow' });
    } else if (mode === 'slow-sentence') {
      if (updateDaily) setTaskFlag('sentenceHeard');
      speakPractice([sentenceItem], button, { speed: 'slow' });
    } else if (mode === 'repeat-word') {
      if (updateDaily) setTaskFlag('wordHeard');
      speakPractice([wordItem], button, { repeat: 3, pauseMs: 550 });
    } else if (mode === 'word-sentence') {
      if (updateDaily) {
        setTaskFlag('wordHeard');
        setTaskFlag('sentenceHeard');
      }
      speakPractice([wordItem, sentenceItem], button, { pauseMs: 800 });
    }
  }

  document.addEventListener('click', event => {
    const taskButton = event.target.closest('[data-daily-task]');
    if (taskButton) goToTask(taskButton.dataset.dailyTask);

    const audioButton = event.target.closest('[data-audio-mode]');
    if (audioButton) playMode(audioButton.dataset.audioMode, audioButton, getWord(todaysWordIndex()));

    const reviewAudioButton = event.target.closest('[data-review-audio-mode]');
    if (reviewAudioButton && reviewQueue[reviewIndex] !== undefined) {
      playMode(reviewAudioButton.dataset.reviewAudioMode, reviewAudioButton, getWord(reviewQueue[reviewIndex]), false);
    }

    const guideSpeak = event.target.closest('[data-guide-speak]');
    if (guideSpeak) speak(guideSpeak.dataset.guideSpeak, guideSpeak, guideSpeak.dataset.guideHint || '');
  });

  $('speakTodayBtn')?.addEventListener('click', () => setTaskFlag('wordHeard'));
  $('practiceTodayBtn')?.addEventListener('click', () => setTaskFlag('wordHeard'));
  $('speakSentenceBtn')?.addEventListener('click', () => setTaskFlag('sentenceHeard'));
  $('scriptQuizChoices')?.addEventListener('click', () => setTimeout(renderDailyGuide, 0));
  $('resetBtn')?.addEventListener('click', () => setTimeout(() => {
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

  ensureDailyGuide();
  ensurePronunciationLabs();
  renderAll();
  renderDailyGuide();
})();
