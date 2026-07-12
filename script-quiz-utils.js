// Shared answer-safe quiz construction for Persian script practice.
(() => {
  const SCRIPT_KEY = 'farsi-script-v1';
  const STUDIED_PREFIX = 'farsi-guided-letter-studied-';
  const MAX_RECENT = Math.max(0, SCRIPT_LESSONS.length - 1);
  const VISUAL_GROUPS = [
    ['ب', 'پ', 'ت', 'ث'],
    ['ج', 'چ', 'ح', 'خ'],
    ['د', 'ذ'],
    ['ر', 'ز', 'ژ'],
    ['س', 'ش'],
    ['ص', 'ض'],
    ['ط', 'ظ'],
    ['ع', 'غ'],
    ['ف', 'ق'],
    ['ک', 'گ'],
    ['ا', 'د', 'ر', 'و'],
    ['ل', 'م', 'ن'],
    ['ه', 'ی']
  ];

  function shuffle(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const next = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[next]] = [copy[next], copy[index]];
    }
    return copy;
  }

  function readObject(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...fallback, ...value }
        : { ...fallback };
    } catch {
      return { ...fallback };
    }
  }

  function parseDayKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!match) return null;
    const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isFinite(value) ? Math.floor(value / DAY_MS) : null;
  }

  function curriculumDay() {
    const key = typeof CURRICULUM_START !== 'undefined' ? CURRICULUM_START : '2024-01-01';
    return parseDayKey(key) ?? 0;
  }

  function indexForDayKey(key) {
    const ordinal = parseDayKey(key);
    if (ordinal === null || !SCRIPT_LESSONS.length) return null;
    const offset = ordinal - curriculumDay();
    return ((offset % SCRIPT_LESSONS.length) + SCRIPT_LESSONS.length) % SCRIPT_LESSONS.length;
  }

  function studiedDayKeys() {
    const keys = new Set();
    const script = readObject(SCRIPT_KEY, { completed: {} });
    Object.entries(script.completed || {}).forEach(([key, complete]) => {
      if (complete) keys.add(key);
    });
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(STUDIED_PREFIX) && localStorage.getItem(key) === '1') {
        keys.add(key.slice(STUDIED_PREFIX.length));
      }
    }
    return [...keys];
  }

  function studiedCandidates(limit = MAX_RECENT) {
    const todayOrdinal = parseDayKey(todayKey());
    if (todayOrdinal === null) return [];
    const current = dayNumber() % SCRIPT_LESSONS.length;
    const mostRecentByIndex = new Map();

    studiedDayKeys().forEach(key => {
      const ordinal = parseDayKey(key);
      const index = indexForDayKey(key);
      if (ordinal === null || index === null || ordinal >= todayOrdinal || index === current) return;
      const daysAgo = todayOrdinal - ordinal;
      const existing = mostRecentByIndex.get(index);
      if (!existing || daysAgo < existing.daysAgo) {
        mostRecentByIndex.set(index, { index, daysAgo, studiedOn: key });
      }
    });

    return [...mostRecentByIndex.values()]
      .sort((left, right) => left.daysAgo - right.daysAgo)
      .slice(0, Math.max(0, limit));
  }

  function primarySound(sound) {
    return String(sound || '').toLowerCase().split(/[\s/(,]/).filter(Boolean)[0] || '';
  }

  function hasUniqueSound(index) {
    const sound = primarySound(SCRIPT_LESSONS[index]?.sound);
    return Boolean(sound) && SCRIPT_LESSONS.filter(lesson => primarySound(lesson.sound) === sound).length === 1;
  }

  function questionFor(index, requestedMode = 0) {
    const lesson = SCRIPT_LESSONS[index];
    const mode = ((Number(requestedMode) % 3) + 3) % 3;
    if (mode === 0 && hasUniqueSound(index)) {
      return { type: 'sound', text: `Which letter makes the “${lesson.sound}” sound?` };
    }
    if (mode === 1) {
      return { type: 'name', text: `Which letter is called “${lesson.name}”?` };
    }
    const formIndex = 1 + ((index + mode) % 3);
    const labels = ['', 'starting', 'middle', 'ending'];
    const form = lesson.forms?.[formIndex] || lesson.letter;
    return {
      type: 'form',
      formIndex,
      html: `Which base letter matches this ${labels[formIndex]} form? <span class="script-form-cue" lang="fa" dir="rtl">${escapeHTML(form)}</span>`
    };
  }

  function visualPeers(index) {
    const letter = SCRIPT_LESSONS[index]?.letter;
    const group = VISUAL_GROUPS.find(values => values.includes(letter)) || [];
    return group
      .map(value => SCRIPT_LESSONS.findIndex(lesson => lesson.letter === value))
      .filter(value => value >= 0 && value !== index);
  }

  function validDistractor(index, targetIndex, question) {
    if (index === targetIndex) return false;
    if (question.type === 'sound') {
      return primarySound(SCRIPT_LESSONS[index].sound) !== primarySound(SCRIPT_LESSONS[targetIndex].sound);
    }
    if (question.type === 'form') {
      return SCRIPT_LESSONS[index].forms?.[question.formIndex] !== SCRIPT_LESSONS[targetIndex].forms?.[question.formIndex];
    }
    return true;
  }

  function buildChoices(targetIndex, question, count = 4) {
    const studied = studiedCandidates(SCRIPT_LESSONS.length).map(candidate => candidate.index);
    const current = dayNumber() % SCRIPT_LESSONS.length;
    if (current !== targetIndex) studied.push(current);
    const learned = [...new Set(studied)].filter(index => validDistractor(index, targetIndex, question));
    const visual = visualPeers(targetIndex).filter(index => validDistractor(index, targetIndex, question));
    const all = SCRIPT_LESSONS.map((_, index) => index).filter(index => validDistractor(index, targetIndex, question));
    const ordered = [
      ...shuffle(learned.filter(index => visual.includes(index))),
      ...shuffle(learned.filter(index => !visual.includes(index))),
      ...shuffle(visual.filter(index => !learned.includes(index))),
      ...shuffle(all.filter(index => !learned.includes(index) && !visual.includes(index)))
    ];
    const distractors = [...new Set(ordered)].slice(0, Math.max(1, count - 1));
    return shuffle([targetIndex, ...distractors]);
  }

  const api = { primarySound, hasUniqueSound, questionFor, buildChoices, studiedCandidates };
  window.FarsiScriptQuiz = api;
  window.getStudiedScriptCandidates = studiedCandidates;
  if (window.__FARSI_TEST__) window.__FARSI_SCRIPT_QUIZ_TEST__ = api;
})();
