(() => {
  const SCRIPT_KEY = 'farsi-script-v1';
  let questionNumber = 0;
  let lastAnswerCorrect = false;

  function loadProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(SCRIPT_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? { attempts: 0, correct: 0, completed: {}, ...value }
        : { attempts: 0, correct: 0, completed: {} };
    } catch {
      return { attempts: 0, correct: 0, completed: {} };
    }
  }

  const saveProgress = progress => localStorage.setItem(SCRIPT_KEY, JSON.stringify(progress));
  const currentIndex = () => dayNumber() % SCRIPT_LESSONS.length;
  const currentLesson = () => SCRIPT_LESSONS[currentIndex()];
  const quiz = () => window.FarsiScriptQuiz;

  function renderScore() {
    const progress = loadProgress();
    const attempts = Number(progress.attempts || 0);
    const correct = Number(progress.correct || 0);
    const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
    const done = Boolean(progress.completed?.[todayKey()]);
    $('scriptQuizScore').textContent = `${done ? 'Daily script quiz complete · ' : ''}${correct} correct of ${attempts} attempts${attempts ? ` · ${accuracy}%` : ''}`;
  }

  function setQuizReady() {
    const lessonCard = document.querySelector('#scriptView .script-card');
    const quizCard = document.querySelector('#scriptView .script-quiz-card:not(.script-review-card)');
    if (!lessonCard || !quizCard) return;
    lessonCard.classList.remove('hidden');
    ['scriptQuizPrompt', 'scriptQuizChoices', 'scriptQuizResult', 'scriptNextQuizBtn']
      .forEach(id => $(id)?.classList.add('hidden'));
    let start = quizCard.querySelector('[data-script-start]');
    if (!start) {
      start = document.createElement('button');
      start.type = 'button';
      start.className = 'primary-btn';
      start.dataset.scriptStart = 'true';
      start.textContent = 'Start quiz';
      quizCard.appendChild(start);
    }
    start.classList.remove('hidden');
  }

  function startQuiz() {
    document.querySelector('#scriptView .script-card')?.classList.add('hidden');
    $('scriptQuizPrompt')?.classList.remove('hidden');
    $('scriptQuizChoices')?.classList.remove('hidden');
    document.querySelector('[data-script-start]')?.classList.add('hidden');
  }

  function renderQuiz(autoStart = false) {
    lastAnswerCorrect = false;
    const targetIndex = currentIndex();
    const question = quiz().questionFor(targetIndex, questionNumber);
    const prompt = $('scriptQuizPrompt');
    if (question.html) prompt.innerHTML = question.html;
    else prompt.textContent = question.text;
    $('scriptQuizResult').textContent = '';
    $('scriptQuizResult').className = 'script-quiz-result hidden';
    $('scriptNextQuizBtn').classList.add('hidden');

    const container = $('scriptQuizChoices');
    container.innerHTML = '';
    quiz().buildChoices(targetIndex, question).forEach(index => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'script-choice';
      button.textContent = SCRIPT_LESSONS[index].letter;
      button.lang = 'fa';
      button.dir = 'rtl';
      button.dataset.scriptChoice = String(index);
      container.appendChild(button);
    });
    setQuizReady();
    if (autoStart) startQuiz();
  }

  function answerQuiz(button) {
    const selected = Number(button.dataset.scriptChoice);
    const correctIndex = currentIndex();
    const correct = selected === correctIndex;
    const progress = loadProgress();
    progress.attempts = Number(progress.attempts || 0) + 1;
    if (correct) {
      progress.correct = Number(progress.correct || 0) + 1;
      progress.completed = progress.completed || {};
      progress.completed[todayKey()] = true;
    }
    saveProgress(progress);
    lastAnswerCorrect = correct;

    document.querySelectorAll('#scriptQuizChoices [data-script-choice]').forEach(choice => {
      choice.disabled = true;
      const index = Number(choice.dataset.scriptChoice);
      if (index === correctIndex) choice.classList.add('correct');
      else if (choice === button) choice.classList.add('wrong');
    });

    const lesson = currentLesson();
    const result = $('scriptQuizResult');
    result.textContent = correct ? 'Correct — nice work.' : `Not quite. Today’s letter is ${lesson.letter} (${lesson.name}).`;
    result.className = `script-quiz-result ${correct ? 'good' : 'bad'}`;
    const next = $('scriptNextQuizBtn');
    next.textContent = correct ? 'Finish lesson' : 'Try this letter again';
    next.classList.remove('hidden');
    document.querySelector('#scriptView .script-card')?.classList.remove('hidden');
    renderScore();
  }

  function renderLesson() {
    const lesson = currentLesson();
    const index = currentIndex();
    $('scriptDay').textContent = `Letter ${index + 1} of ${SCRIPT_LESSONS.length}`;
    $('scriptLetter').textContent = lesson.letter;
    $('scriptName').textContent = `${lesson.name} · ${lesson.nameFa}`;
    $('scriptSound').textContent = `Sound: ${lesson.sound}`;
    [$('scriptIsolated'), $('scriptInitial'), $('scriptMedial'), $('scriptFinal')]
      .forEach((element, formIndex) => { element.textContent = lesson.forms[formIndex]; });
    $('scriptExampleFa').textContent = lesson.exampleFa;
    $('scriptExampleLatin').textContent = lesson.exampleLatin;
    $('scriptExampleEn').textContent = lesson.exampleEn;
    renderQuiz();
    renderScore();
  }

  function visibleSentence(fromReview) {
    const text = $(fromReview ? 'reviewExampleFa' : 'todayExampleFa')?.textContent?.trim();
    if (text) return text;
    const index = fromReview ? reviewQueue[reviewIndex] : todaysWordIndex();
    const word = getWord(index);
    return word ? practiceSentence(word).fa : '';
  }

  async function speakCurrentSentence(button, fromReview = false) {
    const text = visibleSentence(fromReview);
    if (!text) return false;

    const index = fromReview ? reviewQueue[reviewIndex] : todaysWordIndex();
    const word = getWord(index);
    if (word?.fa === text) {
      toast('The full sentence is not available yet.');
      return false;
    }

    window.FarsiSentenceAudio?.primeRemote?.(text, 'normal');
    if (window.FarsiSentenceAudio?.playPersian) {
      return window.FarsiSentenceAudio.playPersian(text, button, 'normal');
    }

    const sentence = word ? practiceSentence(word) : { latin: '' };
    return speak(text, button, sentence.latin || '');
  }

  $('speakSentenceBtn').addEventListener('click', event => speakCurrentSentence(event.currentTarget));
  $('speakReviewSentenceBtn').addEventListener('click', event => speakCurrentSentence(event.currentTarget, true));
  $('speakScriptExampleBtn').addEventListener('click', event => {
    const lesson = currentLesson();
    speak(lesson.exampleFa, event.currentTarget, lesson.exampleLatin);
  });
  $('scriptQuizChoices').addEventListener('click', event => {
    const button = event.target.closest('[data-script-choice]');
    if (button && !button.disabled) answerQuiz(button);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-script-start]')) startQuiz();
  });
  $('scriptNextQuizBtn').addEventListener('click', () => {
    if (lastAnswerCorrect) {
      document.dispatchEvent(new CustomEvent('farsi:script-completed', { detail: { date: todayKey() } }));
      return;
    }
    questionNumber += 1;
    renderQuiz(true);
  });

  renderLesson();
  renderAll();
})();
