(() => {
  function verbEnglishPhrase(value) {
    return String(value || '').replace(/^to\s+/i, '');
  }

  function renderFullConjugations(verb) {
    const labels = { present: 'Present', past: 'Past', subjunctive: 'Subjunctive', future: 'Future' };
    const help = { present: 'I go / I am going', past: 'I went', subjunctive: 'that I go / let me go', future: 'I will go' };
    const tables = Object.keys(labels).map((tense, tableIndex) => `
      <section class="conjugation-tense${tableIndex === 0 ? ' active' : ''}" data-tense-panel="${tense}">
        <p class="tense-help">${help[tense]}</p>
        ${verb[tense].map((form, index) => `<div class="conjugation-row"><span class="conjugation-pronoun" lang="fa" dir="rtl">${escapeHTML(verb.pronouns[index])}</span><strong lang="fa" dir="rtl">${escapeHTML(form)}</strong><button type="button" class="conjugation-speak" data-speak-form="${escapeHTML(form)}" aria-label="Hear ${escapeHTML(form)}">🔊</button></div>`).join('')}
      </section>`).join('');
    const tabs = Object.entries(labels).map(([tense, label], index) =>
      `<button type="button" data-tense="${tense}" class="${index === 0 ? 'active' : ''}">${label}</button>`
    ).join('');
    return `<div class="tense-tabs" role="tablist" aria-label="Verb tense">${tabs}</div><div class="conjugation-tables">${tables}</div>`;
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
    const sentence = practiceSentence(word);
    container.innerHTML = `
      <div class="beginner-verb">
        <div class="beginner-verb-heading"><div><span class="verb-label">USEFUL VERB TODAY</span><strong lang="fa" dir="rtl">${escapeHTML(verb.infinitive)}</strong><span>${escapeHTML(verb.latin)} · ${escapeHTML(verb.en)}</span></div></div>
        <div class="verb-useful-grid">
          <article class="verb-useful-card"><small>Useful now</small><strong lang="fa" dir="rtl">${escapeHTML(usefulForm)}</strong><span>I ${escapeHTML(english)}</span><button type="button" class="verb-practice-audio" data-guide-speak="${escapeHTML(usefulForm)}" aria-label="Hear useful verb form">🔊 Hear it</button></article>
          <article class="verb-useful-card phrase"><small>Say it in a sentence</small><strong lang="fa" dir="rtl">${escapeHTML(sentence.fa)}</strong>${sentence.latin ? `<span class="verb-phrase-latin">${escapeHTML(sentence.latin)}</span>` : ''}<span>${escapeHTML(sentence.en)}</span><button type="button" class="verb-practice-audio" data-guide-speak="${escapeHTML(sentence.fa)}" data-guide-hint="${escapeHTML(sentence.latin)}" aria-label="Hear example sentence">🔊 Hear phrase</button></article>
        </div>
        <details class="full-conjugations"><summary>View all conjugations</summary><div class="full-conjugations-body">${renderFullConjugations(verb)}</div></details>
      </div>`;
  };

  function ensureReviewPronunciationLab() {
    if ($('reviewPronunciationLab')) return;
    const example = $('reviewExampleBox');
    if (!example) return;
    const lab = document.createElement('section');
    lab.id = 'reviewPronunciationLab';
    lab.className = 'pronunciation-lab review-pronunciation-lab';
    lab.innerHTML = `
      <div class="pronunciation-actions">
        <button type="button" data-review-audio-mode="slow-word"><strong>Slow answer</strong><span>Hear each sound</span></button>
        <button type="button" data-review-audio-mode="repeat-word"><strong>Repeat ×3</strong><span>Say it aloud</span></button>
        <button type="button" data-review-audio-mode="word-sentence"><strong>Word → sentence</strong><span>Use it in context</span></button>
      </div>
      <p id="reviewSpeechStatus" class="speech-status" role="status" aria-live="polite"></p>`;
    example.insertAdjacentElement('afterend', lab);
  }

  async function playReviewMode(mode, button) {
    if (!sanitizeReviewQueue()) return false;
    const word = getWord(reviewQueue[reviewIndex]);
    if (!word) return false;
    const wordItem = { text: word.fa, phoneticHint: word.latin || '' };
    const sentence = practiceSentence(word);
    const sentenceItem = { text: sentence.fa, phoneticHint: sentence.latin };
    if (mode === 'slow-word') return speakPractice([wordItem], button, { speed: 'slow' });
    if (mode === 'repeat-word') return speakPractice([wordItem], button, { repeat: 3, pauseMs: 550 });
    if (mode === 'word-sentence') return speakPractice([wordItem, sentenceItem], button, { pauseMs: 800 });
    return false;
  }

  function updateReviewSpeechStatus(message, isError = false) {
    const status = $('reviewSpeechStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  document.addEventListener('click', event => {
    const reviewAudio = event.target.closest('[data-review-audio-mode]');
    if (reviewAudio) playReviewMode(reviewAudio.dataset.reviewAudioMode, reviewAudio);
    const guideSpeak = event.target.closest('[data-guide-speak]');
    if (guideSpeak) speak(guideSpeak.dataset.guideSpeak, guideSpeak, guideSpeak.dataset.guideHint || '');
  });

  document.addEventListener('farsi:speech-start', event => {
    if (event.detail?.button?.closest('#reviewView')) updateReviewSpeechStatus('Playing…');
  });
  document.addEventListener('farsi:speech-complete', event => {
    if (event.detail?.button?.closest('#reviewView')) updateReviewSpeechStatus('Played successfully.');
  });
  document.addEventListener('farsi:speech-error', event => {
    if (event.detail?.button?.closest('#reviewView')) {
      updateReviewSpeechStatus('Couldn’t play. Try again or check media volume.', true);
    }
  });

  $('revealBtn')?.addEventListener('click', () => {
    $('speakReviewBtn')?.classList.remove('hidden');
    window.setTimeout(() => $('reviewAnswer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  });

  ensureReviewPronunciationLab();
  renderAll();
})();
