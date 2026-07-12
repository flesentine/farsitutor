(() => {
  const SCRIPT_KEY = 'farsi-script-v1';
  let questionNumber = 0;

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

  function shuffle(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const next = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[next]] = [copy[next], copy[index]];
    }
    return copy;
  }

  function primarySound(sound) {
    return String(sound || '').toLowerCase().split(/[\s/(,]/).filter(Boolean)[0] || '';
  }

  function hasUniqueSound(index) {
    const sound = primarySound(SCRIPT_LESSONS[index]?.sound);
    return SCRIPT_LESSONS.filter(lesson => primarySound(lesson.sound) === sound).length === 1;
  }

  function questionFor(index) {
    const lesson = SCRIPT_LESSONS[index];
    const mode = questionNumber % 3;
    if (mode === 0 && hasUniqueSound(index)) {
      return { type: 'sound', text: `Which letter makes the “${lesson.sound}” sound?` };
    }
    if (mode < 2) return { type: 'name', text: `Which letter is called “${lesson.name}”?` };
    return {
      type: 'example',
      html: `Which letter appears in <span lang="fa" dir="rtl">${escapeHTML(lesson.exampleFa)}</span> (${escapeHTML(lesson.exampleLatin)}, ${escapeHTML(lesson.exampleEn)})?`
    };
  }

  function validDistractor(index, targetIndex, type) {
    if (index === targetIndex) return false;
    const target = SCRIPT_LESSONS[targetIndex];
    const candidate = SCRIPT_LESSONS[index];
    if (type === 'sound') return primarySound(candidate.sound) !== primarySound(target.sound);
    if (type === 'example') return !String(target.exampleFa || '').includes(candidate.letter);
    return true;
  }

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
      start.textContent = 'Start quiz without the answer showing';
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

  function renderQuiz() {
    const targetIndex = currentIndex();
    const question = questionFor(targetIndex);
    const prompt = $('scriptQuizPrompt');
    if (question.html) prompt.innerHTML = question.html;
    else prompt.textContent = question.text;
    $('scriptQuizResult').textContent = '';
    $('scriptQuizResult').className = 'script-quiz-result hidden';
    $('scriptNextQuizBtn').classList.add('hidden');

    const candidates = SCRIPT_LESSONS.map((_, index) => index)
      .filter(index => validDistractor(index, targetIndex, question.type));
    const choices = shuffle([targetIndex, ...shuffle(candidates).slice(0, 3)]);
    const container = $('scriptQuizChoices');
    container.innerHTML = '';
    choices.forEach(index => {
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
    $('scriptNextQuizBtn').classList.remove('hidden');
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

  function speakCurrentSentence(button, fromReview = false) {
    const index = fromReview ? reviewQueue[reviewIndex] : todaysWordIndex();
    const word = getWord(index);
    if (!word) return;
    const sentence = practiceSentence(word);
    speak(sentence.fa, button, sentence.latin);
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
    questionNumber += 1;
    renderQuiz();
  });

  renderLesson();
  renderAll();
})();
