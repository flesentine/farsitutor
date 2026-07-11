(() => {
  const SCRIPT_KEY = 'farsi-script-v1';
  let scriptQuestionNumber = 0;
  let scriptState = loadScriptState();

  function loadScriptState() {
    try {
      return { attempts: 0, correct: 0, completed: {}, ...JSON.parse(localStorage.getItem(SCRIPT_KEY) || '{}') };
    } catch {
      return { attempts: 0, correct: 0, completed: {} };
    }
  }

  function saveScriptState() {
    localStorage.setItem(SCRIPT_KEY, JSON.stringify(scriptState));
  }

  function currentScriptIndex() {
    return dayNumber() % SCRIPT_LESSONS.length;
  }

  function currentScriptLesson() {
    return SCRIPT_LESSONS[currentScriptIndex()];
  }

  function shuffle(values) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function renderScriptLesson() {
    const lesson = currentScriptLesson();
    const index = currentScriptIndex();
    $('scriptDay').textContent = `Letter ${index + 1} of ${SCRIPT_LESSONS.length}`;
    $('scriptLetter').textContent = lesson.letter;
    $('scriptName').textContent = `${lesson.name} · ${lesson.nameFa}`;
    $('scriptSound').textContent = `Sound: ${lesson.sound}`;
    [$('scriptIsolated'), $('scriptInitial'), $('scriptMedial'), $('scriptFinal')].forEach((el, i) => { el.textContent = lesson.forms[i]; });
    $('scriptExampleFa').textContent = lesson.exampleFa;
    $('scriptExampleLatin').textContent = lesson.exampleLatin;
    $('scriptExampleEn').textContent = lesson.exampleEn;
    renderScriptQuiz();
    renderScriptScore();
  }

  function quizMode() {
    return scriptQuestionNumber % 3;
  }

  function renderScriptQuiz() {
    const lesson = currentScriptLesson();
    const index = currentScriptIndex();
    const mode = quizMode();
    const distractorIndexes = shuffle(SCRIPT_LESSONS.map((_, i) => i).filter(i => i !== index)).slice(0, 3);
    const choices = shuffle([index, ...distractorIndexes]);
    const prompt = mode === 0
      ? `Which letter makes the “${lesson.sound}” sound?`
      : mode === 1
        ? `Which letter is called “${lesson.name}”?`
        : `Which letter from today’s lesson appears in “${lesson.exampleLatin}” (${lesson.exampleEn})?`;
    $('scriptQuizPrompt').textContent = prompt;
    $('scriptQuizResult').textContent = '';
    $('scriptQuizResult').className = 'script-quiz-result';
    $('scriptNextQuizBtn').classList.add('hidden');
    const container = $('scriptQuizChoices');
    container.innerHTML = '';
    choices.forEach(choiceIndex => {
      const choice = SCRIPT_LESSONS[choiceIndex];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'script-choice';
      button.textContent = choice.letter;
      button.dataset.scriptChoice = String(choiceIndex);
      button.setAttribute('aria-label', choice.name);
      container.appendChild(button);
    });
  }

  function answerScriptQuiz(button) {
    const selected = Number(button.dataset.scriptChoice);
    const correctIndex = currentScriptIndex();
    const correct = selected === correctIndex;
    scriptState.attempts += 1;
    if (correct) {
      scriptState.correct += 1;
      scriptState.completed[todayKey()] = true;
    }
    saveScriptState();
    document.querySelectorAll('[data-script-choice]').forEach(choice => {
      choice.disabled = true;
      const choiceIndex = Number(choice.dataset.scriptChoice);
      if (choiceIndex === correctIndex) choice.classList.add('correct');
      else if (choice === button) choice.classList.add('wrong');
    });
    const result = $('scriptQuizResult');
    result.textContent = correct ? 'Correct — nice work.' : `Not quite. Today’s letter is ${currentScriptLesson().letter} (${currentScriptLesson().name}).`;
    result.classList.add(correct ? 'good' : 'bad');
    $('scriptNextQuizBtn').classList.remove('hidden');
    renderScriptScore();
  }

  function renderScriptScore() {
    const accuracy = scriptState.attempts ? Math.round((scriptState.correct / scriptState.attempts) * 100) : 0;
    const done = Boolean(scriptState.completed[todayKey()]);
    $('scriptQuizScore').textContent = `${done ? 'Daily script quiz complete · ' : ''}${scriptState.correct} correct of ${scriptState.attempts} attempts${scriptState.attempts ? ` · ${accuracy}%` : ''}`;
  }

  function practiceSentence(word) {
    if (word?.exFa) {
      return { fa: word.exFa, latin: word.exLatin || '', en: word.exEn || '' };
    }
    return {
      fa: `من کلمهٔ «${word.fa}» را یاد می‌گیرم.`,
      latin: `Man kalame-ye “${word.latin}” râ yâd migiram.`,
      en: `I am learning the Persian word for “${word.en}.”`
    };
  }

  const originalRenderToday = renderToday;
  renderToday = function renderTodayWithSentence() {
    originalRenderToday();
    const word = getWord(todaysWordIndex());
    const sentence = practiceSentence(word);
    const box = $('todayExampleFa').closest('.example-box');
    box.classList.remove('hidden');
    $('todayExampleFa').textContent = sentence.fa;
    $('todayExampleLatin').textContent = sentence.latin;
    $('todayExampleEn').textContent = sentence.en;
  };

  function reviewStage(card) {
    if ((card?.good || 0) < 3) return 'english';
    if ((card?.good || 0) < 6) return 'latin';
    return 'script';
  }

  const originalRenderReviewCard = renderReviewCard;
  renderReviewCard = function renderReviewCardEnglishFirst() {
    const has = reviewQueue.length > 0 && reviewIndex < reviewQueue.length;
    $('reviewEmpty').classList.toggle('hidden', has);
    $('reviewCard').classList.toggle('hidden', !has);
    if (!has) return;

    const index = reviewQueue[reviewIndex];
    const word = getWord(index);
    const card = state.cards[index];
    const stage = reviewStage(card);
    const prompt = $('reviewPrompt');
    prompt.classList.remove('flash-prompt-english', 'flash-prompt-latin');
    prompt.removeAttribute('lang');
    prompt.removeAttribute('dir');

    if (stage === 'english') {
      $('reviewDirection').textContent = 'English → spoken Persian';
      prompt.textContent = word.en;
      prompt.classList.add('flash-prompt-english');
    } else if (stage === 'latin') {
      $('reviewDirection').textContent = 'Pronunciation → Persian script';
      prompt.textContent = word.latin;
      prompt.classList.add('flash-prompt-latin');
    } else {
      $('reviewDirection').textContent = 'Persian script → meaning';
      prompt.textContent = word.fa;
      prompt.lang = 'fa';
      prompt.dir = 'rtl';
    }

    $('reviewAnswerFarsi').textContent = word.fa;
    $('reviewLatin').textContent = word.latin;
    $('reviewMeaning').textContent = word.en;
    const exampleBox = $('reviewExampleBox');
    const sentence = practiceSentence(word);
    exampleBox.classList.remove('hidden');
    $('reviewExampleFa').textContent = sentence.fa;
    $('reviewExampleLatin').textContent = sentence.latin;
    $('reviewExampleEn').textContent = sentence.en;
    renderVerbDetails('reviewVerbPanel', word);
    $('reviewCounter').textContent = `${reviewIndex + 1} of ${reviewQueue.length}`;
    $('reviewProgressFill').style.width = `${(reviewIndex / reviewQueue.length) * 100}%`;
    $('reviewAnswer').classList.add('hidden');
    $('revealBtn').classList.remove('hidden');
  };

  function speakCurrentSentence(button, fromReview = false) {
    const word = fromReview
      ? getWord(reviewQueue[reviewIndex])
      : getWord(todaysWordIndex());
    const sentence = practiceSentence(word);
    speak(sentence.fa, button, sentence.latin);
  }

  $('speakSentenceBtn').addEventListener('click', event => speakCurrentSentence(event.currentTarget));
  $('speakReviewSentenceBtn').addEventListener('click', event => speakCurrentSentence(event.currentTarget, true));
  $('speakScriptExampleBtn').addEventListener('click', event => {
    const lesson = currentScriptLesson();
    speak(lesson.exampleFa, event.currentTarget, lesson.exampleLatin);
  });
  $('scriptQuizChoices').addEventListener('click', event => {
    const button = event.target.closest('[data-script-choice]');
    if (button && !button.disabled) answerScriptQuiz(button);
  });
  $('scriptNextQuizBtn').addEventListener('click', () => {
    scriptQuestionNumber += 1;
    renderScriptQuiz();
  });

  renderScriptLesson();
  renderAll();
  if (typeof originalRenderReviewCard !== 'function') console.warn('Review renderer was not available.');
})();
